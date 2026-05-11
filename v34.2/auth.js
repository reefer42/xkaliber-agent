const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class AuthManager {
    constructor(userDataPath) {
        this.usersFile = path.join(userDataPath, 'users_v32.json');
        this.sessions = new Map(); // token -> username
        this.users = this.loadUsers();
    }

    loadUsers() {
        if (fs.existsSync(this.usersFile)) {
            try {
                return JSON.parse(fs.readFileSync(this.usersFile, 'utf8'));
            } catch (e) {
                console.error('Failed to load users:', e);
                return {};
            }
        }
        return {};
    }

    saveUsers() {
        try {
            fs.writeFileSync(this.usersFile, JSON.stringify(this.users, null, 2));
        } catch (e) {
            console.error('Failed to save users:', e);
        }
    }

    async register(username, password) {
        if (this.users[username]) {
            throw new Error('User already exists');
        }
        const isFirst = Object.keys(this.users).length === 0;
        const hashedPassword = await bcrypt.hash(password, 10);
        this.users[username] = { 
            password: hashedPassword,
            role: isFirst ? 'admin' : 'user',
            permissions: {
                canUseApp: isFirst, // Default deny for standard users
                canUseTools: isFirst // Only admin gets tools enabled by default
            }
        };
        this.saveUsers();
        return true;
    }

    async login(username, password) {
        const user = this.users[username];
        if (!user) {
            throw new Error('Invalid username or password');
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            throw new Error('Invalid username or password');
        }
        if (!user.permissions.canUseApp) {
            throw new Error('Account pending admin approval');
        }
        const token = crypto.randomBytes(32).toString('hex');
        this.sessions.set(token, username);
        return token;
    }

    verifyToken(token) {
        const username = this.sessions.get(token);
        if (!username) return null;
        const user = this.users[username];
        if (!user) return null;
        return { username, role: user.role, permissions: user.permissions };
    }

    logout(token) {
        this.sessions.delete(token);
    }
    
    hasUsers() {
        return Object.keys(this.users).length > 0;
    }

    getAllUsers(requesterUsername) {
        const requester = this.users[requesterUsername];
        if (!requester || requester.role !== 'admin') throw new Error('Unauthorized');
        
        const userList = [];
        for (const [uname, data] of Object.entries(this.users)) {
            userList.push({
                username: uname,
                role: data.role,
                permissions: data.permissions
            });
        }
        return userList;
    }

    updateUserPermissions(requesterUsername, targetUsername, permissions) {
        const requester = this.users[requesterUsername];
        if (!requester || requester.role !== 'admin') throw new Error('Unauthorized');
        if (!this.users[targetUsername]) throw new Error('User not found');
        
        this.users[targetUsername].permissions = { 
            ...this.users[targetUsername].permissions, 
            ...permissions 
        };
        this.saveUsers();
        return true;
    }
}

module.exports = AuthManager;
