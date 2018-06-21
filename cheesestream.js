function cheesestream(port, streamId) {
    var BufferReader = require('buffer-reader');
var child = require('child_process');
var io = require('socket.io');
var events = require('events');

var express = require('express')
var app = express();
var server = require('http').Server(app);

var io = require('socket.io')(server);
var fs = require('fs');
var request = require('request');
var querystring = require('querystring');
var crypto = require('crypto');

    // posting port number and live status.
    var streamidentifier = streamId.slice(5);

    request.get('http://back3ndb0is.herokuapp.com/login', function(error, response, next){
        name = "Stream";
        responseToken = response.headers.token;

        var form = {
            port: port
        };
    
        // var formData = querystring.stringify(form);
        var formData = JSON.stringify(form);
        signature = signToken(form); 
        var contentLength = formData.length;
    
        console.log(streamidentifier);
        request({
            headers: {
            'name': name,
            'token': responseToken,
            'signature': signature,
            'Content-Type': 'application/json',
            },
            uri: 'http://back3ndb0is.herokuapp.com/streams/' + streamidentifier + '/toggle',
            body: formData,
            method: 'POST'
        }, function (err, res, body) {
            if(!err) { console.log(res) }
        });
    });

    var spawn = child.spawn;
    var exec = child.exec;
    var Emitters = {}
    var config = {
        // port:8001,
        //Test url, will always work
        // url:'rtsp://184.72.239.149/vod/mp4:BigBuckBunny_175k.mov'
        url:'rtsp://145.49.53.161:80/' + streamId
    }

    var initEmitter = function(feed){
        if(!Emitters[feed]){
            Emitters[feed] = new events.EventEmitter().setMaxListeners(0)
        }
        return Emitters[feed]
    }
    //Uses the config port, needs a port to send
    console.log('Starting Express Web Server on Port '+port)
    server.listen(port);

    //Always serve index
    // app.get('/', function (req, res) {
    //     res.sendFile(__dirname + '/index.html');
    // })

    //FFMPEG pushed stream in here to make a pipe
    var count = 0; //Can be removed later, once android clears their plan up
    //Uses streamIn for incoming feeds, should be cleaned up later
    app.all('/', function (req, res) {
        //Initial emitter
        req.Emitter = initEmitter(req.params.feed)
        res.connection.setTimeout(0);
        //Buffer, handles authentication
        req.on('data', function(buffer){
            req.Emitter.emit('data',buffer)
            var packetNum = buffer

            var CleanBuffer = "";
            //Package checking part
            count++; //Can be removed, ups package count currently
            var reader = new BufferReader(buffer);
            var str = reader.restAll();

            buffer = buffer.toString('hex');
            const CountBuffer = buffer + "::" + count; //Currently used as testing
    /*
            //Check every 5 packages
            if(count % 5 == 0){ 
                //const CountBuffer = buffer + ":" + countor;
                console.log("=======================================")
                console.log(CountBuffer)
                console.log("=======================================")
            }
            //Cleanup Android stuff
            var CleanBuffer = CountBuffer.split('::')[0]
            console.log("================CLEN===================")
            console.log(CleanBuffer)
            console.log("=======================================")
    */
            //Buffer magic | Testing
            //var cheese = Buffer.from(CountBuffer, "hex")
            //console.log(cheese);

            //Converts stream to hex, for file saving
            var savedStream = Buffer.from(buffer, "hex");
            // console.log(savedStream);
            buffer = buffer.toString('hex');
            // console.log(buffer)

            //Saves stream to file
            // fs.appendFile(port +'.mp4', savedStream, function (err) {
            // if (err) throw err;
            // console.log('Saved!');
            // });

            //Savedstream = Clean Buffer, Verify = Hex, used to check and verify stream
            io.to('STREAM_'+req.params.feed).emit('h264',{feed:req.params.feed,buffer:savedStream, verify: CountBuffer})
        });
        req.on('end',function(){
            console.log('close');
        });
    })

    //socket.io client commands
    io.on('connection', function (cn) {
        cn.on('f',function (data) {
            switch(data.function){
                case'getStream':
                    console.log(data)
                    cn.join('STREAM_'+data.feed)
                break;
            }
        })
    });

    //FFMPEG
    console.log('Starting FFMPEG')

    var ffmpegString = '-i '+config.url+''
    ffmpegString += ' -f mpegts -c:v mpeg1video -codec:a mp2 -b 0 http://localhost:'+port+'/'
    if(ffmpegString.indexOf('rtsp://')>-1){
        ffmpegString='-rtsp_transport tcp '+ffmpegString
    }

    console.log('Executing : ffmpeg '+ffmpegString)
    var ffmpeg = spawn('ffmpeg',ffmpegString.split(' '));

    //Handle close
    ffmpeg.on('close', function (buffer) {
        console.log('ffmpeg died')

        request.get('http://back3ndb0is.herokuapp.com/login', function(error, response, next){
            name = "Stream";
            responseToken = response.headers.token;
            signature = signToken({token: responseToken}); 
    
            var form = {
                port: port
            };
        
            var formData = querystring.stringify(form);
            var contentLength = formData.length;
        
            request({
                headers: {
                'Content-Length': contentLength,
                'Content-Type': 'application/x-www-form-urlencoded',
                'token': responseToken,
                'signature': signature,
                'name': name
                },
                uri: 'http://back3ndb0is.herokuapp.com/streams/' + streamId + '/toggle',
                method: 'DELETE'
            }, function (err, res, body) {
                if(!err){ console.log(body) }

            });
        });
    })

    //Logs via FFMPEG
    ffmpeg.stderr.on('data', function (buffer) {
       console.log(buffer.toString())
    });
    ffmpeg.stdout.on('data', function (buffer) {
       Emitter.emit('data',buffer)
    });

    // private key to test authentication
    var test_key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAwLizso7fI\/91niCy8OKmNvc398+mwvDY8t7loLULYsOAi1QG\nDZaYsKFXKnTRiT5ZnN07XyxrbqRqFmlQspxigZ9eX+dMbKMNns+4lgMBeEUoI7Zz\nqSK9i1r4yQyYpAXepX71luE5zWys84F2Xm92ziMBOYIBJdrhqv76aY0ID5+bPvZe\nhMoa\/nALddFzaE7MS4DbZAM10\/ILPrlTg0C02rUDfRj3huotHUMMe9chouOk+Ddc\nYVqXWt2u7pbHB9\/735yBX2DFlY3dJytUQSMs00HdHxKbcl6IKTMYwRk2AEqH+e5z\n3dCcJP9JBseKdLCK1+xaiYVTs2xEMitD2\/fA3wIDAQABAoIBAChfSP2x4lrnLBuJ\nHBNMV6eSGH5oWLXjwH74ZMBKzOzOqcIGQxJbpvbxhZIWUMLgdeNfkQ15\/7N46+Rw\nAYC5NAWVfi63BJKJgdPwDeoXDRrF2gfJM+eNqIll8FIlumA5\/o9KzmXiHrrC9mQ4\njbRww0GhoaMLcfQdK0MoEQtFiRfEaTd7nr8CJPm0WkTCLl7yZQceSZNzJJagpDPI\nL6H4ifiVi19gxgtb5KaT1vd1HfPEzws5hR+kDYMWaXcVJUc58isYCgLXZ4bZraY2\nz+Gks3vQ6SKcwTZAwUIXgxaDHCT++rL+yfKicjXJ7LH4cWOOaTC5xnQM0QWUxntq\nds2aIBECgYEA9aSGet0AWPSbolU8r\/pxSUUFx3rSHEPFrwCQuaJvOueB9scYdzUP\nvRjoTAdhmPNQvziXR96w947U9FgDuaK\/CAGZlW3vmtEfFvQk\/kVfoFPkESskPsLf\njJK2AdJIxd1\/KKAstIzj5atoS\/GDSNqdPo2qF9SxAvj+xn2lO9HM1ZkCgYEAyNjx\nl1dxEyKywQHEuF6Kxu1Ig4QdDdHvjoZjdfr+ttkCiCc9iuPSC+Aru8AbaC\/UezNt\n4HbuOPB9Xz9j0EhyK4ugaM2rhjSuiVav7Otv6oqorr4QHaQagUmJxBXWhfNWG\/sP\nWxUZTMM92To9iWkASHvNu\/gG4j1GbNONd6OE5TcCgYBhyRoDxQCDaPSfvcDH6TG5\n0jFHxLvppo0Ganoye9g9obVZ8M3rfoMCauzmfzW59npZdQS8Bol6MzDRCEyLVJ8p\nZ8Gk+7ubbM4sjApB8onrwBmVQBBQr7DgO\/MabIStx8v79y90vHVok0CUotL5aJWa\nNjjU\/cVtgoOhrpjdZFpfWQKBgGpYnItC7IdyTu3tTslEnfy4tTWV5YBk0ZBIzi8x\nKF+Oxk1rYaXB\/Xz2RJHUJW7kLIDTeXFp57dUdz3QpbwqL\/Goq9XyWMjl6iikMuCi\nxQ6OPsTPtF7Nfo9Ibd7apU0lzElihP34TP4dPwlfUigI5fJ7QzMtIA\/42+pRlc1s\nUri\/AoGBAIWMAZ9EL8cpVNfnYdSqcDTMOn7ul8gZxHTIXGmbc5tx7vFO8300ZXAF\nyzvlHYxnNreBE4c5iBJxmuzv4RqwwpUvXAv8FhjqaJdLwkri6NmF+MPIxQNM68KP\nOkI7vk3lMxTJC\/7dAzE88o5xJlT42GhdGIi6sRg423sTNK4uOAkL\n-----END RSA PRIVATE KEY-----\n';
    function signToken(data) { // Functie om datas te signen
        if(!data) return false // Om te voorkomen dat alles vastloopt als de data leeg is

        console.log(test_key);
    
        let sign = crypto.createSign('RSA-SHA256') // De sign instantie
        sign.write(JSON.stringify(data)) // Het token wordt gesigned 
        sign.end() 
        return sign.sign(test_key, 'hex') // De signature wordt teruggestuurd
    }

}

module.exports = cheesestream