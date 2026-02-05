exports.up = (pgm) => {
  pgm.addColumns('users', {
    password_hash: { 
      type: 'varchar(255)', 
      notNull: false  // Allow null for existing users, can be required later
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['password_hash']);
};
