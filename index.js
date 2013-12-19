var fs = require('fs'),
  util = require('util');

/**
 * @param app express handle
 * @param options, pass entity and dataFile option parameters

 Usage:
 var fs = require('fs'),
 DATA_FILE = './data/users.json',
 crud = require('./crud');

 module.exports = function (app) {
    crud(app, {dataFile: DATA_FILE, entity: 'users'});
  };

 */
module.exports = function (app) {
  var options = {};

  options.listPattern = '/crud/:entity';
  options.singlePattern = '/crud/:entity/:id';
  console.log('crud service active: ' + options.singlePattern);

  function createError(err) {
    return util.format("{\"error\": \"%s\"}", String(err));
  }


  var getDataFile = function(entity) {
      var dataFile = './data/'+entity+'.json';
      if (!fs.existsSync(dataFile)) {
          fs.writeFileSync(dataFile, '[]', 'utf8');
      }
      return dataFile;
  };

  app.get(options.listPattern, function (req, res) {
    var entity = req.params.entity;
    fs.readFile(getDataFile(entity), 'utf8', function (err, data) {
      var pageData = {};
      var items = JSON.parse(data);
      pageData.total = items.length;
      pageData.pageSize = items.length;
      pageData.currentPage = 1;
      pageData.totalRecords = items.length;
      pageData.data = items;
      res.send(JSON.stringify(pageData));
    });
  });

  app.get(options.singlePattern, function (req, res) {
    var id = parseInt(req.params.id, 10), entity = req.params.entity;
    fs.readFile(getDataFile(entity), 'utf8', function (err, data) {
      if (err) {
        res.end(createError(err));
      } else {
        var all = JSON.parse(data);
        var json = '{}';
        for (var i = 0; i < all.length; i += 1) {
          if (id === all[i].id) {
            json = JSON.stringify(all[i]);
            break;
          }
        }
        res.send(json);
      }
    });
  });

  function nextId(all) {
    var maxId = 0;
    for (var i = 0; i < all.length; i++) {
      if (maxId < all[i].id) {
        maxId = all[i].id;
      }
    }
    return maxId + 1;
  }

  app.post(options.listPattern, function (req, res) {
    var id = 0;
    var created = req.body, entity = req.params.entity;
    var newJson;
    fs.readFile(getDataFile(entity), 'utf8', function (err, data) {
      if (err) {
        res.end(createError(err));
      } else {
        var all = JSON.parse(data);
        id = nextId(all);
        created.id = id;
        all.push(created)
        var newJson = JSON.stringify(all);
        fs.writeFile(getDataFile(entity), newJson, 'utf8', function (err, data) {
          if (err) {
            res.end(createError("error saving " + String(err)));
          } else {
            res.send(JSON.stringify(created));
          }
        });
      }
    });
  });

  app.put(options.singlePattern, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var updated = req.body, entity = req.params.entity;
    var newJson;
    fs.readFile(getDataFile(entity), 'utf8', function (err, data) {
      if (err) {
        res.end(createError(err));
      } else {
        newJson = data;
        var all = JSON.parse(data);
        var json = '{}';
        for (var i = 0; i < all.length; i += 1) {
          if (id === all[i].id) {
            all[i] = updated;
            newJson = JSON.stringify(all);
            break;
          }
        }
        fs.writeFile(getDataFile(entity), newJson, 'utf8', function (err, data) {
          if (err) {
            res.end(createError("error saving " + String(err)));
          } else {
            res.send(JSON.stringify(updated));
          }
        });
      }
    });
  });

  app.delete(options.singlePattern, function (req, res) {
    console.log("deleting object");
    var id = parseInt(req.params.id, 10), entity = req.params.entity;
    var deleted = {};
    var newJson;
    fs.readFile(getDataFile(entity), 'utf8', function (err, data) {
      if (err) {
        res.end(createError(err));
      } else {
        newJson = data;
        var all = JSON.parse(data);
        var json = '{}';
        for (var i = 0; i < all.length; i += 1) {
          if (id === all[i].id) {
            all.splice(i, 1);
            newJson = JSON.stringify(all);
            break;
          }
        }
        fs.writeFile(getDataFile(entity), newJson, 'utf8', function (err, data) {
          if (err) {
            res.end(createError("error saving " + String(err)));
          } else {
            res.send(JSON.stringify(deleted));
          }
        });
      }
    });
  });

};
