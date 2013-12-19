crud-json
=========

crud endpoints backed by json files

```
 var fs = require('fs'),
 DATA_FILE = './data/users.json',
 crud = require('crudjson');

 module.exports = function (app) {
    crud(app, {dataFile: DATA_FILE, entity: 'users'});
  };
