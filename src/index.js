import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import OSM from 'ol/source/OSM';
import Point from 'ol/geom/Point';
import Select from 'ol/interaction/Select';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { Builder, parseString } from 'xml2js'

var parsedContent = null;
var allTrackPoints = null;
var allCoursePoints = null;
var addCB = null;
var updateCB = null;
var delCB = null;

function resetGlobalVariables() {
    parsedContent = null;
    allTrackPoints = null;
    allCoursePoints = null;
}

function strToTypeIndex(str) {
    switch (str) {
        case "Left":
            return 0;
        case "Right":
            return 1;
        case "Straight":
            return 2;
        case "Generic":
            return 3;
    }
}

function addCoursePoint(trackingpointId, name, type, note) {
    console.log("addCoursePoint(%d, %s, %s, %s)", trackingpointId, name, type, note);
    // iterate through trackpoints to find the position in coursepoints to insert
    var prevCoursepointId = 0;
    for (let i = 0; i < trackingpointId; i++) {
        if (allTrackPoints[i].Position[0].LongitudeDegrees[0] == allCoursePoints[prevCoursepointId].Position[0].LongitudeDegrees[0] &&
            allTrackPoints[i].Position[0].LatitudeDegrees[0] == allCoursePoints[prevCoursepointId].Position[0].LatitudeDegrees[0]) {

            prevCoursepointId++;
        }
    }
    var timeA = allTrackPoints[trackingpointId].Time;
    var posA = allTrackPoints[trackingpointId].Position;
    var newCP = {
        Name: [name],
        Time: timeA,
        Position: posA,
        PointType: [type],
        Notes: [note]
    };
    allCoursePoints.splice(prevCoursepointId, 0, newCP);
    selectPoint(trackingpointId);
}

function updateCoursePoint(trackingpointId, idx, name, type, note) {
    console.log("updateCoursePoint()");
    var timeA = allTrackPoints[trackingpointId].Time;
    var posA = allTrackPoints[trackingpointId].Position;
    parsedContent.TrainingCenterDatabase.Courses[0].Course[0].CoursePoint[idx] = {
        Name: [name],
        Time: timeA,
        Position: posA,
        PointType: [type],
        Notes: [note]
    };
    selectPoint(trackingpointId);
}

function delCoursePoint(trackingpointId, idx) {
    console.log("deleteCoursePoint()");
    parsedContent.TrainingCenterDatabase.Courses[0].Course[0].CoursePoint.splice(idx, 1);
    selectPoint(trackingpointId);
}

function selectPoint(idSelected) {
    console.log("idSelected: %d", idSelected);
    // document.getElementById('showLag').innerText = allTrackPoints[idSelected].Position[0].LatitudeDegrees[0];
    // document.getElementById('showLon').innerText = allTrackPoints[idSelected].Position[0].LongitudeDegrees[0];
    var selectedIsCoursePoint = false;
    for (let i = 0; i < allCoursePoints.length; i++) {
        if (allTrackPoints[idSelected].Position[0].LongitudeDegrees[0] == allCoursePoints[i].Position[0].LongitudeDegrees[0] &&
            allTrackPoints[idSelected].Position[0].LatitudeDegrees[0] == allCoursePoints[i].Position[0].LatitudeDegrees[0]) {

            selectedIsCoursePoint = true;
            document.getElementById('showInfo').innerText = "Existing course point!";
            document.getElementById('cpSet').removeAttribute('disabled');
            document.getElementById('cpUnset').removeAttribute('disabled');
            document.getElementById('nameEdit').value = allCoursePoints[i].Name[0];
            document.getElementById('noteEdit').value = allCoursePoints[i].Notes[0];
            document.getElementById('typeEdit').selectedIndex = strToTypeIndex(allCoursePoints[i].PointType[0]);

            document.getElementById('cpSet').removeEventListener('click', updateCB, {once: true});
            document.getElementById('cpSet').removeEventListener('click', addCB, {once: true});
            updateCB = function() {
                    updateCoursePoint(idSelected, i,
                        document.getElementById('nameEdit').value,
                        document.getElementById('typeEdit').selectedOptions[0].value,
                        document.getElementById('noteEdit').value);
                };
            document.getElementById('cpSet').addEventListener('click', updateCB, {once: true});

            document.getElementById('cpUnset').removeEventListener('click', delCB, {once: true});
            delCB = delCoursePoint.bind(undefined, idSelected, i);
            document.getElementById('cpUnset').addEventListener('click', delCB, {once: true});
            break;
        }
    }
    if (!selectedIsCoursePoint) {
        document.getElementById('showInfo').innerText = '';
        document.getElementById('cpSet').removeAttribute('disabled');
        document.getElementById('cpUnset').setAttribute('disabled', '');
        document.getElementById('nameEdit').value = '';
        document.getElementById('noteEdit').value = '';

        document.getElementById('cpSet').removeEventListener('click', updateCB, {once: true});
        document.getElementById('cpSet').removeEventListener('click', addCB, {once: true});
        addCB = function() {
            addCoursePoint(idSelected,
                           document.getElementById('nameEdit').value,
                           document.getElementById('typeEdit').selectedOptions[0].value,
                           document.getElementById('noteEdit').value);
        }
        document.getElementById('cpSet').addEventListener('click', addCB, {once: true});
    }
}

function processTcx(content) {
    resetGlobalVariables();
    document.getElementById("cpEdit").removeAttribute("hidden");
    document.getElementById("save").removeAttribute("disabled");

    // set global variables
    parsedContent = content;
    allTrackPoints = content.TrainingCenterDatabase.Courses[0].Course[0].Track[0].Trackpoint;
    allCoursePoints = content.TrainingCenterDatabase.Courses[0].Course[0].CoursePoint;

    // prepare to draw all track points
    var features = []
    for (let i in allTrackPoints) {
        var lat = parseFloat(allTrackPoints[i].Position[0].LatitudeDegrees[0]);
        var lon = parseFloat(allTrackPoints[i].Position[0].LongitudeDegrees[0]);
        var f = new Feature(new Point(fromLonLat([lon, lat])));
        f.setId(i);
        features.push(f);
    }
    var trackingpointsLayer = new VectorLayer({ source: new VectorSource({ features: features }) });

    let startLat = allTrackPoints.length > 0 ? parseFloat(allTrackPoints[0].Position[0].LatitudeDegrees[0]) : 0;
    let startLon = allTrackPoints.length > 0 ? parseFloat(allTrackPoints[0].Position[0].LongitudeDegrees[0]) : 0;

    var rasterLayer = new TileLayer({
        source: new OSM()
    });

    var select = new Select();

    var map = new Map({
        target: 'map',
        layers: [rasterLayer, trackingpointsLayer],
        view: new View({
            center: fromLonLat([startLon, startLat]),
            zoom: 15
        })
    });

    map.addInteraction(select);
    select.on('select', function(e) {
        selectPoint(e.target.getFeatures().item(0).getId());
    });
}

function handleFileSelect(event) {
    var file = event.target.files[0];
    var reader = new FileReader();
    reader.onload = function (ev) {
        parseString(ev.target.result, function (err, result) {
            processTcx(result);
        });
    }
    reader.readAsText(file);
}

function save() {
    var fs = require('fs');
    var builder = new Builder({
        xmldec: {
            'version': '1.0',
            'encoding': 'UTF-8',
            'standalone': null
        }
    });
    var xml = builder.buildObject(parsedContent);
    xml += '\n';
    var blob = new Blob([xml], { "type": "text/plain" });

    if (window.navigator.msSaveBlob) {
        window.navigator.msSaveBlob(blob, "test.txt");
        window.navigator.msSaveOrOpenBlob(blob, "test.txt");
    } else {
        document.getElementById("download").href = window.URL.createObjectURL(blob);
        document.getElementById("download").click();
    }
}

document.getElementById('file').addEventListener('change', handleFileSelect, false);
document.getElementById('save').addEventListener('click', save, false);
