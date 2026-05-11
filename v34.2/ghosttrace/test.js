const fs = require('fs');
const path = require('path');
const { PipelineTrace, compileExplanation, generateReport, exportBundle } = require('./index.js');

const OUTPUTS_DIR = path.join(__dirname, '..', 'ghosttrace_outputs');
const GHOSTTRACE_DIR = path.join(__dirname, '..', 'data', 'ghosttrace');

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
}

console.log("=== Running GhostTrace Tests ===");

// 1. Test successful run trace
const t1 = new PipelineTrace();
t1.addStep('input.received', 'input', 'ok', 'INPUT_OK', 10);
t1.addStep('output.finalize', 'output', 'ok', 'DONE', 5);
t1.close();
assert(!t1._failed, "Trace should be successful");
assert(t1.outcome === 'ok', "Outcome should be ok");

// 2. Test failed run trace and downstream skipping
const t2 = new PipelineTrace();
t2.addStep('input.received', 'input', 'ok', 'INPUT_OK', 10);
t2.addStep('inference.generate', 'inference', 'error', 'OOM', 100, 'Out of memory');
t2.addStep('tools.execute', 'tools', 'ok', 'TOOL_OK', 0); // This should be overridden to skipped_upstream
t2.close();

assert(t2._failed, "Trace should be failed");
assert(t2.first_failure.code === 'OOM', "First failure should be OOM");
assert(t2.steps[2].outcome === 'skipped_upstream', "Downstream step should be skipped_upstream");

// 3. Test Unknown codes fail validation
let threw = false;
try {
    const t3 = new PipelineTrace();
    t3.addStep('fake.stage', 'input', 'ok', 'CODE', 0);
} catch (e) {
    threw = true;
}
assert(threw, "Unregistered stage should throw error");

// 4. Test secrets are redacted in report
const explanation = compileExplanation(t2);
const reportPath = generateReport(t2, explanation, "My prompt with sk-12345secret", "Some output with ghp_abcde123 token");

const reportContent = fs.readFileSync(reportPath, 'utf8');
assert(reportContent.includes('[REDACTED_SECRET]'), "Secrets should be redacted in report");
assert(!reportContent.includes('sk-12345secret'), "API key should not be in report");
assert(!reportContent.includes('ghp_abcde123'), "GitHub token should not be in report");

// 5. Export bundle is created
const zipPath = exportBundle(t2.run_id);
assert(fs.existsSync(zipPath), "Export bundle zip should be created");

console.log("\nAll GhostTrace tests passed successfully!");
