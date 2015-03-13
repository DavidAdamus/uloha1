var http  = require('http');
var fs    = require('fs');
var url   = require('url');
var redis = require('redis');

var server = http.createServer(requestListener);
var client = redis.createClient();
var writeStream;  

client.on('error', function (err) {
    console.log('redis:error ' + err);
});

client.once('connect', function () {
  writeStream = fs.createWriteStream('./output.txt', {flags: 'a'});
  
  writeStream.on('error', function (err) {
    console.log('writeStream:error ' + err);
  });
  
  writeStream.once('open', function () {
    server.listen(80);
  });
});

function requestListener(req, res) {
  // GET /track?... /else (404 Not Found)
  var urlO = url.parse(req.url, true);
  if (!(req.method === 'GET' &&
        urlO.pathname === '/track' && urlO.search.length > 1)) {
    res.writeHead(404);
    res.end();
    return;
  }

  // write JSON to file
  writeStream.write(JSON.stringify(urlO.query), function () {
    // if querystring.count then increaseby in redis /else (200 OK)
    if (!(urlO.query.count)) {
      res.writeHead(200);
      res.end();
      return;
    }
    
    client.incrby('count', urlO.query.count, function (err) {
      // count is not integer (400 Bad Request) /else (200 OK)
      if (err) {
        console.log('redis:error ' + err);
        res.writeHead(400);
        res.end();
        return;
      }
      res.writeHead(200);
      res.end();
    }); 
  });
}