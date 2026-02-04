exports.up = (pgm) => {
  pgm.addColumns('users', {
    cookie_consent: { 
      type: 'jsonb', 
      notNull: false,
      default: null
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['cookie_consent']);
};
