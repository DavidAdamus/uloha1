var assert = require('assert');
var http   = require('http');
var fs     = require('fs');
var redis  = require('redis');

var server = require('../server.js');
var client = redis.createClient();    

// read last json from file and compare with input
function checkFile(json, done) {
  var fileSize = fs.statSync('./output.txt')['size'];
  var readStream = fs.createReadStream('./output.txt',
    {encoding: 'utf8', start: fileSize-json.length, end: fileSize});
  readStream.once('readable', function() {
    assert.equal(readStream.read(json.length), json);
    done();
  });         
}

describe('server', function () {
  // should return 404  
  describe('should return 404', function () {
    function _404(done) {
      return function (res) {
        assert.equal(404, res.statusCode);
        done();
      };
    }
    
    it('wrong route 1', function (done) {
      http.get('http://localhost/', _404(done));
    });               
    
    it('wrong route 2', function (done) {
      http.get('http://localhost/?count=5', _404(done));
    });                
    
    it('missing query 1', function (done) {
      http.get('http://localhost/track', _404(done));
    });               
    
    it('missing query 2', function (done) {
      http.get('http://localhost/track?', _404(done));
    });
  });
  
  // should return 400 + write to file + print error
  describe('should return 400 + write to file + print error', function () {
    function _400(query, json, done) {
      http.get('http://localhost/track?' + query, function (res) {
        assert.equal(400, res.statusCode);

        checkFile(json, done);         
      });
    }
     
    it('count is not integer 1', function (done) {
      _400('count=a', '{"count":"a"}', done);
    });
    
    it('count is not integer 2', function (done) {
      _400('id=987654321&count=915b&c=555',
        '{"id":"987654321","count":"915b","c":"555"}', done);
    });
  });
  
  // should return 200 + write to file
  describe('should return 200 + write to file', function () {
    function _200(query, json, done) {
      http.get('http://localhost/track?' + query, function (res) {
        assert.equal(200, res.statusCode);

        checkFile(json, done);         
      });
    }
    
    it('valid query 1', function (done) {
      _200('test=0%201%202&some=thing&id=987654321',
        '{"test":"0 1 2","some":"thing","id":"987654321"}', done);
    });
    
    it('valid query 2', function (done) {
      _200('i=u', '{"i":"u"}', done);
    });
  });
  
  // should return 200 + write to file + increaseby redis
  describe('should return 200 + write to file + increaseby redis', function () {
    var count;
    
    beforeEach(function(done){
      client.get('count', function (err, reply) {
        if (err) throw err;
        count = reply;
        done();
      });
    });
    
    function _200redis(query, json, inc, done) {
      http.get('http://localhost/track?' + query, function (res) {
        assert.equal(200, res.statusCode);

        checkFile(json, function () {
          client.get('count', function (err, reply) {
            if (err) throw err;
            assert.equal(count*1 + inc, reply);
            done();
          });
        });      
      });
    }
    
    it('valid query + count 1', function (done) {
      _200redis('id=987654321&count=915&c=555',
        '{"id":"987654321","count":"915","c":"555"}', 915, done);
    });
    it('valid query + count 2', function (done) {
      _200redis('count=0', '{"count":"0"}', 0, done);
    });
    it('valid query + count 3', function (done) {
      _200redis('count=1', '{"count":"1"}', 1, done);
    });
  });
});