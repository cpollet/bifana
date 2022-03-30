'use strict';
const PORT = 8080;
const HOST = '0.0.0.0';

const express = require('express');
const influx = require('influx');
const jwt = require('jsonwebtoken');

process.on('SIGINT', () => {
  console.info("Interrupted");
  process.exit(0);
});

const db = new influx.InfluxDB({
  host: 'influxdb',
  database: 'bifana',
  schema: [
    {
      measurement: 'weight',
      fields: {
        username: influx.FieldType.STRING,
        total: influx.FieldType.INTEGER,
        meat: influx.FieldType.INTEGER
      },
      tags: [
        'username'
      ]
    }
  ]
});

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, token) => {
      if (err) {
        return res.status(403).json({
          errors: [
            {
              error: {
                code: 1001,
                message: 'Token is invalid'
             }
           }
          ]
        });
      }

      req.username = token.username;
      next();
    });
  } else {
    res.status(401).json({
      errors: [
        {
          error: {
            code: 1002,
            message: 'Token is missing'
          }
        }
      ]
    });
  }
};

const app = express();

app.use(express.static('static'));
app.use(express.json());

app.post('/api/token', (req, res) => {
  if (req.body.secret !== process.env.JWT_SECRET) {
    return res.status(401).json({
      errors: [
        {
          error: {
            code: 1000,
            message: 'Secret is invalid'
          }
        }
      ]
    });
  }
  if (typeof req.body.username !== 'string' || req.body.username === '') {
    return res.status(400).json({
      errors: [
        {
          error: {
            code: 1003,
            message: 'Invalid or missing username'
          }
        }
      ]
    });
  }

  res.json({
    errors: [],
    data: {
      token: jwt.sign({username: req.body.username}, process.env.JWT_SECRET)
    }
  })
});

app.post('/api/init', authenticateJWT, (req, res) => {
  db.getDatabaseNames()
    .then(names => {
      if (!names.includes('bifana')) {
        return db.createDatabase('bifana');
      }
    })
    .then(() => {
      return res.json({
        errors: []
      });
    })
    .catch(error => {
      return res.status(500).json({
        errors: [
          {
            error: {
              code: 1006,
              message: "Could not create influxdb database"
            }
          }
        ]
      });
    });
});

app.post('/api/measure', authenticateJWT, (req, res) => {
  var errors = [];
  if (typeof (req.body.weight || {}).total !== 'number') {
    errors.push({
      error: {
        code: 1004,
        message: 'Invalid total weight'
      }
    });
  }
  if (typeof (req.body.weight || {}).meat !== 'number') {
    errors.push({
      error: {
        code: 1005,
        message: 'Invalid meat weight'
      }
    });
  }

  var timestamp = new Date();
  if (typeof req.body.time !== 'undefined') {
    if (typeof req.body.time !== 'string') {
      errors.push({
        error: {
          code: 1005,
          message: 'Invalid time'
        }
      });
    } else {
      timestamp = Date.parse(req.body.time);
      if (!isFinite(timestamp)) {
        errors.push({
          error: {
            code: 1005,
            message: 'Invalid time'
          }
        });
      } else {
        timestamp = new Date(timestamp);
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      errors: errors
    });
  }

  console.log(`user ${req.username} is creating a new point with `
            + `total weight: ${req.body.weight.total} and `
            + `meat weight: ${req.body.weight.meat} `
            + `at ${timestamp}`);

  db.writePoints([
    {
      measurement: 'weight',
      timestamp: timestamp,
      fields: {
        username: req.username,
        total: req.body.weight.total,
        meat: req.body.weight.meat 
      },
      tags: {
        username: req.username
      }
    }
  ], {
    database: 'bifana',
    precision: 's',
  })
  .catch(error => {
    console.error(`Error saving data to InfluxDB! ${error.stack}`);
    return res.status(500).json({
      errors: [
        {
          error: {
            code: 1007,
            message: "Could not insert point"
          }
        }
      ]
    });
  });

  res.json({
    errors: []
  });
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
