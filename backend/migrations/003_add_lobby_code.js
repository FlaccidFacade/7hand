// Public 6-character lobby code; the UUID id stays as the internal primary key.
// Existing rows get no code and are removed by the inactivity cleanup.
exports.up = (pgm) => {
  pgm.addColumn('lobbies', {
    code: { type: 'varchar(6)', unique: true }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('lobbies', 'code');
};
