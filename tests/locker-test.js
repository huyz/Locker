var assert = require("assert");
var vows = require("vows");
var RESTeasy = require("rest-easy");
var http = require("http");
var querystring = require("querystring");
var events = require("events");
var fs = require("fs");


var tests = RESTeasy.describe("Locker core API")

tests.use("localhost", 8042)
    .discuss("Core can")
    .discuss("map existing services with")
        .path("/map")
        .get()
            .expect(200)
            .expect("has an available and installed attribute", function(err, res, body) {
                assert.isNull(err);
                var map = JSON.parse(body);
                assert.include(map, "available");
                assert.include(map, "installed");
                serviceMap = map;
            })
            .expect("has 12 available services", function(err, res, body) {
                var map = JSON.parse(body);
                assert.equal(map.available.length, 12);
            }).expect("has 1 installed service", function(err, res, body) {
                var map = JSON.parse(body);
                var count = 0;
                for (var key in map.installed) {
                    if (map.installed.hasOwnProperty(key)) ++count;
                }
                assert.equal(count, 1);
            }).expect("has the required test services installed", function(err, res, body) {
                var map = JSON.parse(body);
                assert.include(map.installed, "testURLCallback");
                // Add statements here to test for services required to test
            })
    .unpath().undiscuss()

    .path("/install")
    .discuss("install an available service")
        /************
         * XXX Right now we're relying on the hello world application to exist, maybe we should make a testing app?
         */
        .setHeader("Content-Type", "application/json")
        .discuss("but requires a srcdir attribute")
            .post({"invalid":"invalid"})
                .expect(400)
        .undiscuss()
        .discuss("and fails on an invalid service")
            .post({"srcdir":"invalid"})
                .expect(404)
        .undiscuss()
        .discuss("by srcdir attribute")
            .post({"srcdir":"Apps/HelloWorld"})
                .expect(200)
                .expect("and returns the installed service information", function(err, res, body) {
                    var svcInfo = JSON.parse(body);
                    assert.include(svcInfo, "id");
                    assert.include(svcInfo, "uri");
                })
                .expect("and has a created instance directory", function(err, res, body) {
                    var svcInfo = JSON.parse(body);
                    fs.statSync("../Me/" + svcInfo.id + "/me.json").isFile();
                })
        .undiscuss()
    .undiscuss().unpath()

    .path("/Me")
    .discuss("proxy requests via GET to services")
        .get("testURLCallback/test")
            .expect(200)
            .expect({url:"/test", method:"GET"})
        .get("invalidServicename/test")
            .expect(404)
    .undiscuss().unpath()

    .path("/Me")
    .discuss("proxy requests via POST to services")
        .post("testURLCallback/test", {test:"test"})
            .expect(200)
            .expect({url:"/test", method:"POST"})
        .post("invalidServicename/test")
            .expect(404)
    .undiscuss().unpath()

    .path("/diary")
    .discuss("store diary messages")
        .post({level:2, message:"Test message"})
            .expect(200)
    .undiscuss().unpath();

// Test this after the main suite so we're sure the diary POST is done
tests.next().discuss("retrieve stored diary messages")
    .path("/diary")
    .get()
        .expect(200)
        .expect("that have full info", function(err, res, body) {
            var diaryLine = JSON.parse(body);
            assert.include(diaryLine, "message");
            assert.include(diaryLine, "level");
            assert.include(diaryLine, "timestamp");
        })
    .undiscuss().unpath();

tests.next().suite.addBatch({
    "Core can schedule a uri callback" : {
        topic:function() {
            var promise = new events.EventEmitter;
            var when = new Date;
            when.setTime(when.getTime() + 250);
            var options = {
                host:"localhost",
                port:8042,
                path:"/at?" + querystring.stringify({at:when.getTime()/1000,id:"testURLCallback",cb:"/write"}) 
            };
            try {
                fs.unlinkSync("../Me/testURLCallback/result.json");
            } catch (E) {
            }
            http.get(options, function(res) {
                setTimeout(function() {
                    fs.stat("../Me/testURLCallback/result.json", function(err, stats) {
                        if (!err)
                            promise.emit("success", true);
                        else
                            promise.emit("error", err);
                    });
                }, 500);
            }).on("error", function(e) {
                promise.emit("error", e);
            });
            return promise;
        },
        "and is called":function(err, stat) {
            assert.isNull(err);
        }
    }
});

tests.export(module);