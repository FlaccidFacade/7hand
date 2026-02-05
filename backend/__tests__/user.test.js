const { User, UserManager } = require('../user');

describe('User', () => {
  describe('constructor', () => {
    it('should create a user with provided data', () => {
      const userData = {
        username: 'testuser',
        displayName: 'Test User',
        email: 'test@example.com'
      };
      const user = new User(userData);
      
      expect(user.id).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.displayName).toBe('Test User');
      expect(user.email).toBe('test@example.com');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.coins).toBe(0);
      expect(user.stats).toEqual({
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0
      });
    });

    it('should use username as displayName if not provided', () => {
      const user = new User({ username: 'testuser' });
      expect(user.displayName).toBe('testuser');
    });

    it('should generate UUID if id not provided', () => {
      const user = new User({ username: 'testuser' });
      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe('string');
    });
  });

  describe('validate', () => {
    it('should validate a correct user', () => {
      const user = new User({ username: 'validuser' });
      const validation = user.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject missing username', () => {
      const user = new User({});
      const validation = user.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Username is required and must be a string');
    });

    it('should reject username that is too short', () => {
      const user = new User({ username: 'ab' });
      const validation = user.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Username must be between 3 and 20 characters');
    });

    it('should reject username that is too long', () => {
      const user = new User({ username: 'a'.repeat(21) });
      const validation = user.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Username must be between 3 and 20 characters');
    });

    it('should reject username with invalid characters', () => {
      const user = new User({ username: 'user@name!' });
      const validation = user.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Username can only contain letters, numbers, hyphens, and underscores');
    });

    it('should reject display name that is too long', () => {
      const user = new User({ 
        username: 'testuser',
        displayName: 'a'.repeat(31)
      });
      const validation = user.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Display name must be 30 characters or less');
    });

    it('should reject invalid email format', () => {
      const user = new User({ 
        username: 'testuser',
        email: 'invalid-email'
      });
      const validation = user.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid email format');
    });

    it('should accept valid email', () => {
      const user = new User({ 
        username: 'testuser',
        email: 'valid@example.com'
      });
      const validation = user.validate();
      expect(validation.valid).toBe(true);
    });

    it('should accept username with hyphens and underscores', () => {
      const user = new User({ username: 'test-user_123' });
      const validation = user.validate();
      expect(validation.valid).toBe(true);
    });
  });

  describe('updateActivity', () => {
    it('should update lastActive timestamp', () => {
      const user = new User({ username: 'testuser' });
      const originalLastActive = user.lastActive;
      
      // Wait a bit to ensure time difference
      jest.advanceTimersByTime(1000);
      user.updateActivity();
      
      expect(user.lastActive.getTime()).toBeGreaterThanOrEqual(originalLastActive.getTime());
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(originalLastActive.getTime());
    });
  });

  describe('updateStats', () => {
    it('should update user stats', () => {
      const user = new User({ username: 'testuser' });
      user.updateStats({ gamesPlayed: 5, gamesWon: 3 });
      
      expect(user.stats.gamesPlayed).toBe(5);
      expect(user.stats.gamesWon).toBe(3);
      expect(user.stats.gamesLost).toBe(0);
    });

    it('should merge stats instead of replacing', () => {
      const user = new User({ username: 'testuser' });
      user.updateStats({ gamesPlayed: 5 });
      user.updateStats({ gamesWon: 3 });
      
      expect(user.stats.gamesPlayed).toBe(5);
      expect(user.stats.gamesWon).toBe(3);
      expect(user.stats.gamesLost).toBe(0);
    });
  });

  describe('toSafeObject', () => {
    it('should return safe user object without sensitive data', () => {
      const user = new User({
        username: 'testuser',
        displayName: 'Test User',
        email: 'test@example.com'
      });
      
      const safeObject = user.toSafeObject();
      
      expect(safeObject.id).toBeDefined();
      expect(safeObject.username).toBe('testuser');
      expect(safeObject.displayName).toBe('Test User');
      expect(safeObject.coins).toBe(0);
      expect(safeObject.stats).toBeDefined();
      expect(safeObject.createdAt).toBeDefined();
      expect(safeObject.lastActive).toBeDefined();
      expect(safeObject.email).toBeUndefined();
    });
  });
});

describe('UserManager', () => {
  let manager;

  beforeEach(() => {
    manager = new UserManager();
  });

  describe('createUser', () => {
    it('should create and store a new user', () => {
      const user = manager.createUser({ username: 'testuser' });
      
      expect(user).toBeInstanceOf(User);
      expect(manager.getUser(user.id)).toBe(user);
    });

    it('should throw error for invalid user data', () => {
      expect(() => {
        manager.createUser({ username: 'ab' }); // too short
      }).toThrow('User validation failed');
    });
  });

  describe('getUser', () => {
    it('should retrieve user by ID', () => {
      const user = manager.createUser({ username: 'testuser' });
      const retrieved = manager.getUser(user.id);
      
      expect(retrieved).toBe(user);
    });

    it('should return undefined for non-existent user', () => {
      const retrieved = manager.getUser('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getUserByUsername', () => {
    it('should retrieve user by username', () => {
      const user = manager.createUser({ username: 'testuser' });
      const retrieved = manager.getUserByUsername('testuser');
      
      expect(retrieved).toBe(user);
    });

    it('should return undefined for non-existent username', () => {
      const retrieved = manager.getUserByUsername('nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('updateUser', () => {
    it('should update user display name', () => {
      const user = manager.createUser({ username: 'testuser' });
      const updated = manager.updateUser(user.id, { displayName: 'New Name' });
      
      expect(updated.displayName).toBe('New Name');
      expect(updated.username).toBe('testuser');
    });

    it('should update user email', () => {
      const user = manager.createUser({ username: 'testuser' });
      const updated = manager.updateUser(user.id, { email: 'new@example.com' });
      
      expect(updated.email).toBe('new@example.com');
    });

    it('should update user stats', () => {
      const user = manager.createUser({ username: 'testuser' });
      const updated = manager.updateUser(user.id, { stats: { gamesPlayed: 10 } });
      
      expect(updated.stats.gamesPlayed).toBe(10);
    });

    it('should return null for non-existent user', () => {
      const updated = manager.updateUser('non-existent', { displayName: 'Test' });
      expect(updated).toBeNull();
    });

    it('should throw error for invalid updates', () => {
      const user = manager.createUser({ username: 'testuser' });
      
      expect(() => {
        manager.updateUser(user.id, { displayName: 'a'.repeat(31) });
      }).toThrow('User validation failed');
    });

    it('should not allow username updates', () => {
      const user = manager.createUser({ username: 'testuser' });
      manager.updateUser(user.id, { username: 'newusername' });
      
      expect(user.username).toBe('testuser');
    });
  });

  describe('removeUser', () => {
    it('should remove user from manager', () => {
      const user = manager.createUser({ username: 'testuser' });
      manager.removeUser(user.id);
      
      expect(manager.getUser(user.id)).toBeUndefined();
    });
  });
});
