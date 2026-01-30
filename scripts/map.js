const markerGroups = {};
var map;
var popupOverlay;
var table;

$(function () {
	initialize();
	Search();
});

function initialize(){
	const source = new ol.source.XYZ({
		tileUrlFunction: function (tileCoord) {
			if (!tileCoord) return undefined;

			const [z, x, y] = tileCoord;

			var key = z + '/' + y + '/' + x;
			var file = 'tiles/' + key + '.jpg';
			return file;
		}
	});

	map = new ol.Map({
		target: 'map',
		layers: [
			new ol.layer.Tile({ source: source })
		],
		view: new ol.View({
			center: [-8, -53],
			zoom: 4,
			minZoom: 4,
			maxZoom: 8
		})
	});
	
	const coordsDiv = document.getElementById('coords');

    map.on('pointermove', function(evt) {
		const coord = ol.proj.toLonLat(evt.coordinate);
		const lon = coord[0].toFixed(5);
		const lat = coord[1].toFixed(5);
		coordsDiv.textContent = `Coordinates: ${lat}, ${lon}`;
    });
	
	const popupContainer = document.getElementById('popup');
	const popupContent = document.getElementById('popup-content');

	popupOverlay = new ol.Overlay({
	    element: popupContainer,
	    positioning: 'bottom-center',
	    stopEvent: true,
	    offset: [0, -15]
	});

	map.addOverlay(popupOverlay);
	
	map.on('singleclick', function (evt) {
		const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);

		if (!feature) {
			popupOverlay.setPosition(undefined);
			return;
		}

		var coordinates;
		if(feature.get('object').shape=="point"){
			coordinates = feature.getGeometry().getCoordinates();
		}else{
			const polygon = feature.getGeometry();
			coordinates = polygon.getInteriorPoint().getCoordinates();
		}
		
		var command;
		var textCommand;
		if(feature.get('object').isShow){
			command = `hideMarker('${feature.get('object').id}','${feature.get('object').type}')`;
			textCommand = "Hide";
		}else{
			command = `restoreMarker('${feature.get('object').id}')`;
			textCommand = "Restore";
		}
		
		
		
		popupContent.innerHTML = `
			<div>${feature.get('object').description}</div><br>
			<button id="popup-btn" onclick="${command}">${textCommand}</button>
		`;

		popupOverlay.setPosition(coordinates);
	});
	
	$('#filter-dialog').dialog({
    autoOpen: false,
		modal: true,
		width: 400,
		buttons: {
		  'Search': function () {
			  $(this).dialog('close');
			  Search();
		  },
		  'Cancel': function () {
			$(this).dialog('close');
		  }
		}
	});
	
	$('#receipt-dialog').dialog({
    autoOpen: false,
		modal: true,
		width: 1600
	});
	
	table = $('#receipts-table').DataTable({
        paging: true,
        searching: true,
        ordering: true,   // сортировка по колонкам
        order: [[1, 'asc']], // начальная сортировка по Product
		data:[],
		paging: false,
		scrollY: '600px',
        columns: [
			{ data: 'name' },
			{ data: 'description' },
			{ data: 'loc' },
			{ data: 'reputation' }
		]
    });
}

function createMarkerGroup(groupName) {
    if (markerGroups[groupName]) return; // уже есть
    const vectorSource = new ol.source.Vector();
    const markerLayer = new ol.layer.Vector({
      source: vectorSource,
      style: new ol.style.Style({
        image: new ol.style.Icon({
          src: 'images/somberseason.png',
          imgSize: [10, 10],
          anchor: [0.5, 1]
        })
      })
    });
    map.addLayer(markerLayer);
    markerGroups[groupName] = { layer: markerLayer, source: vectorSource };
}

function addMarker(object) {
    if (!markerGroups[object.type]) createMarkerGroup(object.type); 
	
	var marker;
	
	if(object.shape=="polygon"){
		var coordinates = [];
		object.position.forEach(p => {
			coordinates.push(ol.proj.fromLonLat([p[0], p[1]]));
		});

		marker = new ol.Feature({
		  geometry: new ol.geom.Polygon([coordinates]),
		  object: object
		});
		
		marker.setStyle(
		  new ol.style.Style({
			fill: new ol.style.Fill({
			  color: 'rgba(0, 0, 255, 0.2)' // полупрозрачный
			}),
			stroke: new ol.style.Stroke({
			  color: 'rgba(0, 0, 255, 0.6)',
			  width: 2
			})
		  })
		);
	}else{
		marker = new ol.Feature({
			geometry: new ol.geom.Point(ol.proj.fromLonLat([object.position.x, object.position.y])),
			object: object,
		});
		
		marker.setStyle(new ol.style.Style({
		  image: new ol.style.Icon({
			src: object.img,
			imgSize: [10, 10],
			anchor: [0.5, 1]
		  })
		}));
	}

	marker.setId(object.id);
    markerGroups[object.type].source.addFeature(marker);
    return marker;
}

function removeMarker(id, type) {
    if (markerGroups[type]) {
		const feature = markerGroups[type].source.getFeatureById(id);
		markerGroups[type].source.removeFeature(feature);
    }
}

function removeMarkerGroup(groupName) {
    if (markerGroups[groupName]) {
        map.removeLayer(markerGroups[groupName].layer);
        delete markerGroups[groupName];
    }
}

function hideMarker(id, type){
	console.log("hide marker:"+id);
	removeMarker(id, type);
	popupOverlay.setPosition(undefined);
	mapData.hidenMarkers.push(id);
	saveDatas();
}

function restoreMarker(id){
	console.log("restore marker:"+id);
	const index = mapData.hidenMarkers.findIndex(item => item === id);
	if (index !== -1) {
	    mapData.hidenMarkers.splice(index, 1);
	}
	saveDatas();
	Search();
}

function showFilter(){
	$('#filter-dialog').dialog('open');
}

function showReceipts(){
	$('#receipt-dialog').dialog('open');
	PrepareReceipts();
	table.clear().rows.add(receipts).draw();
}

function Search(){
	PrepareMarkers();
	
	removeMarkerGroup("flags");
	removeMarkerGroup("locations");
	removeMarkerGroup("quests");
	removeMarkerGroup("elexirs");
	removeMarkerGroup("bosses");
	removeMarkerGroup("somberseasons");
	removeMarkerGroup("resources");
	removeMarkerGroup("regions");
	
	Filter(flags);
	Filter(locations);
	Filter(elexirs);
	Filter(bosses);
	Filter(somberseasons);
	Filter(resources);
	Filter(regions);
}

function Filter(markers){
	var selected = $('#filter-marker-types').val();
	var isAll = selected.includes('all');
	var searchString = $("#filter-search").val();
	var hiden = $("#filter-hiden").val();
	var skillName = $("#filter-skill-name").val();
	var skillFrom = $("#filter-skill-from").val();
	var skillTo = $("#filter-skill-to").val();
	markers.forEach(marker => {
		var isExist = true;
		
		if(!isAll && !selected.includes(marker.type)){
			isExist = false;
		}
		
		if(searchString!=null && searchString!=""){
			var parts = searchString.split('|').map(s => s.trim()).filter(Boolean);
			if(!parts.some(p => marker.description.toLowerCase().includes(p.toLowerCase()))){
				isExist = false;
			}
		}
		
		if ((hiden == "nonHiden" && !marker.isShow) || 
			(hiden == "hiden" && marker.isShow)){
			isExist = false;
		}
		
		if(skillName!=""){
			isExist = matchSkill(marker.description, skillName, skillFrom, skillTo)
		}
		
		if(isExist){
			addMarker(marker);
		}
	});
}

function matchSkill(text, skillName, skillFrom, skillTo) {
    if (!text || !skillName) return false;

    const regex = new RegExp(
        `${skillName}\\s*\\(?\\s*(\\d+)\\s*\\)?`,
        'i'
    );

    const match = text.match(regex);
    if (!match) return false;

    const value = parseInt(match[1], 10);

    // нижний порог
    if (skillFrom !== '' && skillFrom != null) {
        if (value < Number(skillFrom)) return false;
    }

    // верхний порог
    if (skillTo !== '' && skillTo != null) {
        if (value > Number(skillTo)) return false;
    }

	return true;
}

function showMark(x, y){
	if (!markerGroups["mark"]) createMarkerGroup("mark"); 
	
	var marker;
	
	marker = new ol.Feature({
			geometry: new ol.geom.Point(ol.proj.fromLonLat([x, y])),
		});
		
		marker.setStyle(new ol.style.Style({
		  image: new ol.style.Icon({
			src: "images/markers/circle.png",
			imgSize: [10, 10],
			anchor: [0.5, 0.5]
		  })
		}));

	marker.setId("mark");
    markerGroups["mark"].source.addFeature(marker);
}