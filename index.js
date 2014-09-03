
var Uploader = require('s3-upload-stream').Uploader;
var downloader = require('s3-download-stream');
var debug = require('debug')('s3-blob-store');
var mime = require('mime-types');
var aws = require('aws-sdk');
var through = require('through2');

function S3BlobStore(opts) {
  if (!(this instanceof S3BlobStore)) return new S3BlobStore(opts);
  opts = opts || {};
  if (!opts.accessKey) throw Error("S3BlobStore accessKey option required");
  if (!opts.secretKey) throw Error("S3BlobStore secretKey option required");
  if (!opts.bucket) throw Error("S3BlobStore bucket option required");
  this.accessKey = opts.accessKey;
  this.secretKey = opts.secretKey;
  this.bucket = opts.bucket;
  this.s3 = new (opts.aws || aws).S3({
    apiVersion: "2006-03-01",
    secretAccessKey: opts.secretKey,
    accessKeyId: opts.accessKey
  });
}

S3BlobStore.prototype.createReadStream = function(opts) {
  var config = { client: this.s3, params: this.downloadParams(opts) };
  return downloader(config)
}


S3BlobStore.prototype.uploadParams = function(opts) {
  var filename = opts.name || opts.filename;
  var key = opts.key || filename;

  var params = {};
  params.Bucket = this.bucket;
  params.Key = key;

  var contentType = filename? mime.lookup(filename) : mime.lookup(opts.key)
  if (contentType) params.ContentType = contentType;

  return params;
}

S3BlobStore.prototype.downloadParams = function(opts) {
  var params = this.uploadParams(opts);
  delete params.ContentType;
  return params;
}


S3BlobStore.prototype.createWriteStream = function(opts, done) {
  var params = this.uploadParams(opts)
  var proxy = through();
  proxy.pause();

  new Uploader({ s3Client: this.s3 }, params, function(err, stream){
    debug('got err %j', err);
    if (err) return done(err);

    proxy.pipe(stream);
    proxy.resume()

    stream.on('error', done);
    stream.on('uploaded', function(res){
      debug('uploaded %j', res);
      done(null, { key: params.Key })
    });

  });

  return proxy;
}

S3BlobStore.prototype.remove = function(opts, done) {
  this.s3.deleteObject({ Bucket: this.bucket, Key: opts.key }, done)
  return this;
}

S3BlobStore.prototype.exists = function(done) {
}

module.exports = S3BlobStore;
