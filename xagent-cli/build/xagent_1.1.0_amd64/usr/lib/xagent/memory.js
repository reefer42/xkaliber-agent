const fs = require('fs');
const path = require('path');
const os = require('os');

class MemoryManager {
    constructor() {
        this.userDataPath = path.join(os.homedir(), '.config', 'xagent');
        if (!fs.existsSync(this.userDataPath)) {
            fs.mkdirSync(this.userDataPath, { recursive: true });
        }
        this.vectorDBPath = path.join(this.userDataPath, 'vectors.json');
        this.vectors = this.loadJSON(this.vectorDBPath, []);
        this.ollamaUrl = 'http://127.0.0.1:11434/api';
    }

    loadJSON(filePath, defaultValue) {
        try {
            if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) { console.error(`Failed to load ${filePath}`, e); }
        return defaultValue;
    }

    saveJSON() {
        try {
            fs.writeFileSync(this.vectorDBPath, JSON.stringify(this.vectors), 'utf-8');
            return true;
        } catch (e) {
            console.error(`Failed to save ${this.vectorDBPath}`, e);
            return false;
        }
    }

    async getEmbedding(text) {
        try {
            const response = await fetch(`${this.ollamaUrl}/embed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'all-minilm', input: text, keep_alive: 0 })
            });
            if (!response.ok) return null;
            const data = await response.json();
            return data.embeddings?.[0];
        } catch (e) {
            return null;
        }
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0.0, normA = 0.0, normB = 0.0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async storeVector(text) {
        const embedding = await this.getEmbedding(text);
        if (embedding) {
            this.vectors.push({ text, embedding, timestamp: Date.now() });
            this.saveJSON();
            return { success: true };
        }
        return { error: "Embedding failed." };
    }

    async queryVectors(queryText, limit = 3) {
        const queryEmbedding = await this.getEmbedding(queryText);
        if (!queryEmbedding) return [];

        const results = this.vectors.map(v => ({
            ...v,
            similarity: this.cosineSimilarity(queryEmbedding, v.embedding)
        }));

        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit).filter(r => r.similarity > 0.3);
    }
}

module.exports = new MemoryManager();
