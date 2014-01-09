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
    crud(app, {prefix: 'public', entity: 'users', method: ['ALL']});
    crud(app, {prefix: 'public', entity: 'products', method: ['GET']});
  };

 */

var ext = function (options) {
    options = options || {};
    options.prefix = options.prefix || ':prefix';
    options.entity = options.entity || ':entity';
    options.methods = options.methods || ['ALL'];
    options.dataDir = options.dataDir || 'data';
    options.validation = options.validation || {};
    options.listPattern = '/' + options.prefix + '/' + options.entity;
    options.singlePattern = '/' + options.prefix + '/' + options.entity + '/:id';
    if (!fs.existsSync(options.dataDir)) {
        fs.mkdirSync(options.dataDir);
    }
    return options;
};

module.exports = function (app, options) {
    options = ext(options);

    function createError(err) {
        return JSON.strinfigy({error: err});
    }

    var getDataFile = function (entity) {
        var dataFile = './data/' + entity + '.json';
        if (!fs.existsSync(dataFile)) {
            fs.writeFileSync(dataFile, '[]', 'utf8');
        }
        return dataFile;
    };

    var findEntity = function (req) {
        return (options.entity === ':entity') ? req.params.entity : options.entity;
    };


    var getList = function (req, res) {
        var entity = findEntity(req);
        var query = req.query;
        fs.readFile(getDataFile(entity), 'utf8', function (err, data) {
            var pageData = {};
            var items = JSON.parse(data);
            var searchParams = [];
            var pageParams = ['offset', 'limit'];
            for (var p in query) {
                if (pageParams.indexOf(p) === -1) {
                    searchParams.push(p);
                }
            }

            var resultSetOptions = {};
            resultSetOptions.offset = parseInt(query['offset']) || 0;
            resultSetOptions.limit = parseInt(query['limit']) || 10;

            var results = [];
            for (var i = 0; i < items.length; i += 1) {
                var item = items[i];
                var matches = true;
                for (var k = 0; k < searchParams.length; k += 1) {
                    if (String(item[searchParams[k]]) !== query[searchParams[k]]) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    results.push(item);
                }
            }

            var data = [];
            var end = resultSetOptions.offset + resultSetOptions.limit;
            end = end > results.length ? results.length : end;
            for (var i = resultSetOptions.offset; i < end; i += 1) {
                data.push(results[i]);
            }


            pageData.total = results.length;
            pageData.limit = resultSetOptions.limit;
            pageData.offset = resultSetOptions.offset;
            pageData.data = data;
            res.writeHead(200, {"Content-Type": "application/json"});
            res.end(JSON.stringify(pageData));
        });
    };


    var getItem = function (req, res, cb) {
        var id = parseInt(req.params.id, 10), entity = findEntity(req);
        fs.readFile(getDataFile(entity), 'utf8', function (err, data) {
            var e, d;
            if (err) {
                e = createError(err);
            } else {
                var all = JSON.parse(data);
                var json = '{}';
                for (var i = 0; i < all.length; i += 1) {
                    if (id === all[i].id) {
                        json = JSON.stringify(all[i]);
                        break;
                    }
                }
                d = json;
            }
            if (cb) {
                cb(e, d);
            } else {
                res.writeHead(200, {"Content-Type": "application/json"});
                res.end(d ? d : e);
            }
        });
    };

    function nextId(all) {
        var maxId = 0;
        for (var i = 0; i < all.length; i++) {
            if (maxId < all[i].id) {
                maxId = all[i].id;
            }
        }
        return maxId + 1;
    }

    var requiredError = function (fieldName) {
        return {
            code: 12001,
            field: fieldName,
            message: util.format("%s is required", fieldName)
        };
    };

    var invalidValueError = function (fieldName, expectedValue) {
        return {
            code: 12002,
            field: fieldName,
            message: util.format('Invalid Value for %s: Expected: %s', fieldName, expectedValue)
        };
    };


    var validate = function (created) {
        var validation = options.validation;
        var requiredFields = validation.required || [];
        var errors = [];
        for (var i = 0, length = requiredFields.length; i < length; i += 1) {
            var fieldName = requiredFields[i];
            if (!created[fieldName]) {
                errors.push(requiredError(fieldName));
            }
        }
        if (errors.length) {
            return errors;
        }

        var custom = validation.custom || [];

        for (var i = 0, max = custom.length; i < max; i += 1) {
            var customField = custom[i];
            var type = customField['type'];
            if (type !== 'in') {
                continue;
            }
            var fieldName = customField.field;
            var fieldValue = created[fieldName];
            var matched = 0;
            for (var j = 0, valLength = customField.values.length; j < valLength; j += 1) {
                if (fieldValue === customField.values[j]) {
                    matched = 1;
                    break;
                }
            }
            if (typeof fieldValue !== 'undefined' && !matched) {
                errors.push(invalidValueError(fieldName, customField.values.join(', ')));
            }
        }

        if (errors.length) {
            return errors;
        }

        var requiredIf = validation.requiredIf || [];

        for (var i = 0, length = requiredIf.length; i < length; i += 1) {
            var fieldExpectation = requiredIf[i];
            var field = fieldExpectation.field;
            if (created[field] === fieldExpectation.value) {
                for (var j = 0, fieldLength = fieldExpectation.fields.length; j < fieldLength; j += 1) {
                    var requiredField = fieldExpectation.fields[j];
                    if (typeof created[requiredField] === 'undefined') {
                        errors.push(requiredError(requiredField));
                    }
                }
            }
        }
        return errors;
    };

    var addNewItem = function (req, res) {
        var id = 0;
        var created = req.body, entity = findEntity(req);


        res.writeHead(200, {"Content-Type": "application/json"});
        var errors = validate(created);
        if (errors.length) {
            res.end(JSON.stringify(errors));
            return;
        }

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
                        res.end(JSON.stringify(created));
                    }
                });
            }
        });
    };

    var entityUpdater = function (id, entity) {

        return function (updatedJson, cb) {
            var updated = JSON.parse(updatedJson);
            var newJson;
            fs.readFile(getDataFile(entity), 'utf8', function (err, data) {
                if (err) {
                    cb(err);
                } else {
                    newJson = data;
                    var all = JSON.parse(data);
                    for (var i = 0; i < all.length; i += 1) {
                        if (id === all[i].id) {
                            all[i] = updated;
                            newJson = JSON.stringify(all);
                            break;
                        }
                    }
                    fs.writeFile(getDataFile(entity), newJson, 'utf8', cb);
                }
            });
        };
    };

    var updateItem = function (req, res) {
        var id = parseInt(req.params.id, 10);
        var updated = req.body, entity = findEntity(req);
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
                res.writeHead(200, {"Content-Type": "application/json"});
                fs.writeFile(getDataFile(entity), newJson, 'utf8', function (err, data) {
                    if (err) {
                        res.end(createError("error saving " + String(err)));
                    } else {
                        res.end(JSON.stringify(updated));
                    }
                });
            }
        });
    };

    if (options.methods.indexOf('ALL') !== -1 || options.methods.indexOf('PUT') !== -1) {
        app.put(options.singlePattern, updateItem);
    }

    var deleteItem = function (req, res) {
        console.log("deleting object");
        var id = parseInt(req.params.id, 10), entity = findEntity(req);
        var deleted = {};
        var newJson;
        res.writeHead(200, {"Content-Type": "application/json"});
        fs.readFile(getDataFile(entity), 'utf8', function (err, data) {
            if (err) {
                res.end(createError(err));
            } else {
                newJson = data;
                var all = JSON.parse(data);
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
                        res.end(JSON.stringify(deleted));
                    }
                });
            }
        });
    };


    if (options.methods.indexOf('ALL') !== -1 || options.methods.indexOf('GET') !== -1) {
        console.log('GET ' + options.listPattern);
        app.get(options.listPattern, getList);
        console.log('GET ' + options.singlePattern);
        app.get(options.singlePattern, function (req, res) {
            getItem(req, res);
        });
    }

    if (options.methods.indexOf('ALL') !== -1 || options.methods.indexOf('POST') !== -1) {
        console.log('POST ' + options.listPattern);
        app.post(options.listPattern, addNewItem);
    }

    if (options.methods.indexOf('ALL') !== -1 || options.methods.indexOf('DELETE') !== -1) {
        console.log('DELETE ' + options.singlePattern);
        app.delete(options.singlePattern, deleteItem);
        var deleteUrl = options.singlePattern + '/delete';
        console.log('POST ' + deleteUrl);
        app.post(deleteUrl, deleteItem);
    }

    var registerMapping = function (mapping) {
        var mappingUri = options.singlePattern + mapping;
        var mappingInstruction = options.mappings[mapping];
        var getFn = mappingInstruction['GET'];
        var postFn = mappingInstruction['POST'];
        if (getFn) {
            console.log('GET ' + mappingUri);
            app.get(mappingUri, function (req, res) {
                res.writeHead(200, {"Content-Type": "application/json"});
                getItem(req, res, function (err, data) {
                    var context = {request: req, response: res, data: data, error: err};
                    res.end(JSON.stringify(getFn(context)));
                });
            });
        }

        if (postFn) {
            console.log('POST ' + mappingUri);
            app.post(mappingUri, function (req, res) {
                res.writeHead(200, {"Content-Type": "application/json"});
                getItem(req, res, function (err, data) {
                    var id = parseInt(req.params.id);
                    var context = {request: req, response: res, data: data, error: err, updater: entityUpdater(id, findEntity(req))};
                    res.end(JSON.stringify(postFn(context)));
                });
            });
        }
    };

    if (options.mappings) {
        for (var mapping in options.mappings) {
            registerMapping(mapping);
        }
    }
};

