import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import OSM from 'ol/source/OSM';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Select from 'ol/interaction/Select';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { Builder, parseString } from 'xml2js'
import { Fill, Stroke, Circle, Style } from 'ol/style';

const nonCoursePointStyle =
    new Style({
        image: new Circle({
            fill: new Fill({color: 'rgba(255,153,22,0.4)'}),
            stroke: new Stroke({color: '#000000', width: 1.25}),
            radius: 5
        })
    }) ;
const coursePointStyle =
    new Style({
        image: new Circle({
            fill: new Fill({color: 'rgba(255,0,0,0.4)'}),
            stroke: new Stroke({color: '#000000', width: 1.25}),
            radius: 5
        })
    }) ;
const selectedStyle =
    new Style({
        image: new Circle({
            fill: new Fill({color: 'rgba(255,0,0,1)'}),
            stroke: new Stroke({color: '#000000', width: 1.25}),
            radius: 6
        })
    }) ;
const lineStyle =
    new Style({
        fill: new Fill({ color: '#00FF00', weight: 4 }),
        stroke: new Stroke({ color: '#00FF00', width: 2 })
    });

var parsedContent = null;
var allTrackPoints = null;
var allCoursePoints = null;
var trackPointIdByLatLon = {}
var addCB = null;
var updateCB = null;
var delCB = null;
var features = null;

function encodeLatLon(lat, lon) {
    return "LAT:" + lat.toString() + "LON:" + lon.toString();
}

function resetGlobalVariables() {
    parsedContent = null;
    allTrackPoints = null;
    allCoursePoints = null;
    trackPointIdByLatLon = {};
    features = null;
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
    features[trackingpointId].setStyle(coursePointStyle);
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
    features[trackingpointId].setStyle(coursePointStyle);
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
    features = [];
    for (let i in allTrackPoints) {
        let lat = parseFloat(allTrackPoints[i].Position[0].LatitudeDegrees[0]);
        let lon = parseFloat(allTrackPoints[i].Position[0].LongitudeDegrees[0]);
        trackPointIdByLatLon[encodeLatLon(lat, lon)] = i;
        let f = new Feature(new Point(fromLonLat([lon, lat])));
        f.setId(i);
        f.setStyle(nonCoursePointStyle);
        features.push(f);
    }
    for (let cp of allCoursePoints) {
        let lat = parseFloat(cp.Position[0].LatitudeDegrees[0]);
        let lon = parseFloat(cp.Position[0].LongitudeDegrees[0]);
        let id = trackPointIdByLatLon[encodeLatLon(lat, lon)];
        features[id].setStyle(coursePointStyle);
    }
    let trackingpointsLayer = new VectorLayer({ source: new VectorSource({ features: features})});

    let coordinates = features.map((f) => f.getGeometry().getCoordinates());
    let lineLayer = new VectorLayer({ source: new VectorSource({ features: [new Feature({
        geometry: new LineString(coordinates)})]}), style: lineStyle});

    let startLat = allTrackPoints.length > 0 ? parseFloat(allTrackPoints[0].Position[0].LatitudeDegrees[0]) : 0;
    let startLon = allTrackPoints.length > 0 ? parseFloat(allTrackPoints[0].Position[0].LongitudeDegrees[0]) : 0;

    let rasterLayer = new TileLayer({
        source: new OSM()
    });

    let select = new Select({style: selectedStyle});

    let map = new Map({
        target: 'map',
        layers: [rasterLayer, trackingpointsLayer, lineLayer],
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
    let file = event.target.files[0];
    let reader = new FileReader();
    reader.onload = function (ev) {
        parseString(ev.target.result, function (err, result) {
            processTcx(result);
        });
    }
    reader.readAsText(file);
}

function save() {
    let builder = new Builder({
        xmldec: {
            'version': '1.0',
            'encoding': 'UTF-8',
            'standalone': null
        }
    });
    let xml = builder.buildObject(parsedContent);
    xml += '\n';
    let blob = new Blob([xml], { "type": "text/plain" });

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
