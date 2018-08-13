import 'ol/ol.css';
import { Map, View } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import OSM from 'ol/source/OSM';
import Point from 'ol/geom/Point';
import Select from 'ol/interaction/Select';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { Builder, parseString } from 'xml2js'

var allTrackPoints = []
var parsedContent = null;

function reset() {
    allTrackPoints = [];
    parsedContent = [];
    document.getElementById("cpEdit").removeAttribute("hidden");
    document.getElementById("save").removeAttribute("disabled");
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
    console.log("addCoursePoint()");
    // iterate through trackpoints to find the position in coursepoints to insert
    var coursePoints = parsedContent.TrainingCenterDatabase.Courses[0].Course[0].CoursePoint;
    var prevCoursepointId = 0;
    for (let i = 0; i < trackingpointId; i++) {
        if (allTrackPoints[i].Position[0].LongitudeDegrees[0] == coursePoints[prevCoursepointId].Position[0].LongitudeDegrees[0] &&
            allTrackPoints[i].Position[0].LatitudeDegrees[0] == coursePoints[prevCoursepointId].Position[0].LatitudeDegrees[0]) {

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
    parsedContent.TrainingCenterDatabase.Courses[0].Course[0].CoursePoint.splice(prevCoursepointId, 0, newCP);
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
}

function delCoursePoint(idx) {
    console.log("deleteCoursePoint()");
    parsedContent.TrainingCenterDatabase.Courses[0].Course[0].CoursePoint.splice(idx, 1);
}

function selectPoint(e) {
    var idSelected = e.target.getFeatures().item(0).getId();
    document.getElementById('showLag').innerText = allTrackPoints[idSelected].Position[0].LatitudeDegrees[0];
    document.getElementById('showLon').innerText = allTrackPoints[idSelected].Position[0].LongitudeDegrees[0];
    var course = parsedContent.TrainingCenterDatabase.Courses[0].Course[0];
    var coursePoints = course.CoursePoint;
    var coursePointExist = false;
    for (let i = 0; i < coursePoints.length; i++) {
        if (allTrackPoints[idSelected].Position[0].LongitudeDegrees[0] == coursePoints[i].Position[0].LongitudeDegrees[0] &&
            allTrackPoints[idSelected].Position[0].LatitudeDegrees[0] == coursePoints[i].Position[0].LatitudeDegrees[0]) {
            coursePointExist = true;
            console.log(coursePoints[i]);
            document.getElementById('showInfo').innerText = "Existing course point!";
            document.getElementById('cpSet').removeAttribute('disabled');
            document.getElementById('cpUnset').removeAttribute('disabled');
            document.getElementById('nameEdit').value = coursePoints[i].Name[0];
            document.getElementById('noteEdit').value = coursePoints[i].Notes[0];
            document.getElementById('typeEdit').selectedIndex = strToTypeIndex(coursePoints[i].PointType[0]);

            document.getElementById('cpSet').addEventListener('click',
                updateCoursePoint.bind(undefined,
                    idSelected, i, 
                    document.getElementById('nameEdit').value,
                    document.getElementById('typeEdit').selectedOptions[0].value,
                    document.getElementById('noteEdit').value),
                {once: true});
            document.getElementById('cpUnset').addEventListener('click', function () {
                delCoursePoint(i);
                // TODO: update display
            }, {once: true});
            break;
        }
    }
    if (!coursePointExist) {
        document.getElementById('showInfo').innerText = '';
        document.getElementById('cpSet').removeAttribute('disabled');
        document.getElementById('cpUnset').setAttribute('disabled', '');
        document.getElementById('nameEdit').value = '';
        document.getElementById('noteEdit').value = '';
        // FIXME:
        document.getElementById('cpSet').addEventListener('click', function () {
            addCoursePoint(idSelected,
                document.getElementById('nameEdit').value,
                document.getElementById('typeEdit').selectedOptions[0].value,
                document.getElementById('noteEdit').value
            );
        }, {once: true});
    }
}

function processTcx(content) {
    reset();

    parsedContent = content;
    var course = content.TrainingCenterDatabase.Courses[0].Course[0];
    var trackpoints = course.Track[0].Trackpoint;

    var features = []
    for (let i = 0; i < trackpoints.length; i++) {
        allTrackPoints.push(trackpoints[i]);
        var lat = parseFloat(trackpoints[i].Position[0].LatitudeDegrees[0]);
        var lon = parseFloat(trackpoints[i].Position[0].LongitudeDegrees[0]);
        var f = new Feature(new Point(fromLonLat([lon, lat])));
        f.setId(i);
        features.push(f);
    }

    var rasterLayer = new TileLayer({
        source: new OSM()
    });

    var trackingpointsLayer = new VectorLayer({ source: new VectorSource({ features: features }) });

    var select = new Select();

    var map = new Map({
        target: 'map',
        layers: [rasterLayer, trackingpointsLayer],
        view: new View({
            center: fromLonLat([139.69466, 35.62574]),
            zoom: 15
        })
    });

    map.addInteraction(select);
    select.on('select', selectPoint);
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