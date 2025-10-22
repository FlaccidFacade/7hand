const { 
  User,
  saveUserToDb, 
  removeUserFromDb, 
  loadUserFromDb,
  loadUserByUsernameFromDb,
  loadAllUsersFromDb,
  updateUserActivity
} = require('../user');
const { connect, disconnect, getPool } = require('../db');

describe('User Database Operations', () => {
  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    const pool = getPool();
    await pool.query('DELETE FROM users');
  });

  describe('saveUserToDb', () => {
    it('should save a new user to database', async () => {
      const user = new User({
        username: 'testuser',
        displayName: 'Test User',
        email: 'test@example.com'
      });

      await saveUserToDb(user);

      const dbUser = await loadUserFromDb(user.id);
      expect(dbUser).toBeDefined();
      expect(dbUser.username).toBe('testuser');
      expect(dbUser.display_name).toBe('Test User');
      expect(dbUser.email).toBe('test@example.com');
    });

    it('should update existing user on conflict', async () => {
      const user = new User({
        username: 'testuser',
        displayName: 'Original Name'
      });

      await saveUserToDb(user);
      
      user.displayName = 'Updated Name';
      await saveUserToDb(user);

      const dbUser = await loadUserFromDb(user.id);
      expect(dbUser.display_name).toBe('Updated Name');
    });

    it('should save user stats as JSON', async () => {
      const user = new User({
        username: 'testuser'
      });
      user.updateStats({ gamesPlayed: 5, gamesWon: 3 });

      await saveUserToDb(user);

      const dbUser = await loadUserFromDb(user.id);
      expect(dbUser.stats).toEqual({
        gamesPlayed: 5,
        gamesWon: 3,
        gamesLost: 0
      });
    });
  });

  describe('loadUserFromDb', () => {
    it('should load user from database', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com'
      });

      await saveUserToDb(user);
      const loaded = await loadUserFromDb(user.id);

      expect(loaded).toBeDefined();
      expect(loaded.id).toBe(user.id);
      expect(loaded.username).toBe('testuser');
    });

    it('should return null for non-existent user', async () => {
      const { v4: uuidv4 } = require('uuid');
      const loaded = await loadUserFromDb(uuidv4());
      expect(loaded).toBeNull();
    });
  });

  describe('loadUserByUsernameFromDb', () => {
    it('should load user by username', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com'
      });

      await saveUserToDb(user);
      const loaded = await loadUserByUsernameFromDb('testuser');

      expect(loaded).toBeDefined();
      expect(loaded.id).toBe(user.id);
      expect(loaded.username).toBe('testuser');
    });

    it('should return null for non-existent username', async () => {
      const loaded = await loadUserByUsernameFromDb('nonexistent');
      expect(loaded).toBeNull();
    });

    it('should enforce unique username constraint', async () => {
      const { v4: uuidv4 } = require('uuid');
      const user1 = new User({ id: uuidv4(), username: 'testuser' });
      const user2 = new User({ id: uuidv4(), username: 'testuser' });

      await saveUserToDb(user1);
      
      await expect(saveUserToDb(user2)).rejects.toThrow();
    });
  });

  describe('loadAllUsersFromDb', () => {
    it('should load all users from database', async () => {
      const user1 = new User({ username: 'user1' });
      const user2 = new User({ username: 'user2' });
      const user3 = new User({ username: 'user3' });

      await saveUserToDb(user1);
      await saveUserToDb(user2);
      await saveUserToDb(user3);

      const users = await loadAllUsersFromDb();
      expect(users.length).toBe(3);
      expect(users.map(u => u.username)).toContain('user1');
      expect(users.map(u => u.username)).toContain('user2');
      expect(users.map(u => u.username)).toContain('user3');
    });

    it('should return empty array when no users exist', async () => {
      const users = await loadAllUsersFromDb();
      expect(users).toEqual([]);
    });

    it('should order users by created_at DESC', async () => {
      const user1 = new User({ username: 'user1' });
      await saveUserToDb(user1);
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const user2 = new User({ username: 'user2' });
      await saveUserToDb(user2);

      const users = await loadAllUsersFromDb();
      expect(users[0].username).toBe('user2');
      expect(users[1].username).toBe('user1');
    });
  });

  describe('removeUserFromDb', () => {
    it('should remove user from database', async () => {
      const user = new User({ username: 'testuser' });
      await saveUserToDb(user);

      await removeUserFromDb(user.id);

      const loaded = await loadUserFromDb(user.id);
      expect(loaded).toBeNull();
    });

    it('should not throw error when removing non-existent user', async () => {
      const { v4: uuidv4 } = require('uuid');
      await expect(removeUserFromDb(uuidv4())).resolves.not.toThrow();
    });
  });

  describe('updateUserActivity', () => {
    it('should update user last_active timestamp', async () => {
      const user = new User({ username: 'testuser' });
      await saveUserToDb(user);

      const originalLastActive = (await loadUserFromDb(user.id)).last_active;

      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await updateUserActivity(user.id);

      const updated = await loadUserFromDb(user.id);
      expect(new Date(updated.last_active).getTime()).toBeGreaterThan(
        new Date(originalLastActive).getTime()
      );
    });
  });
});
