import 'ol/ol.css';
import { Map, View } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import OSM from 'ol/source/OSM';
import Point from 'ol/geom/Point';
import Select from 'ol/interaction/Select';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { parseString } from 'xml2js'

var allTrackPoints = []
var parsedContent = null;

function clearGlobal() {
    allTrackPoints = [];
    parsedContent = [];
}

function processTcx(content) {
    clearGlobal();

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
    select.on('select', function (e) {
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
                    document.getElementById('showInfo').innerText = "Existing course point!";
                    break;
                }
        }
        if (!coursePointExist) {
            document.getElementById('showInfo').innerText = '';
        }
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

document.getElementById('file').addEventListener('change', handleFileSelect, false);