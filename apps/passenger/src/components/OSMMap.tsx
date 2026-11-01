import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface MarkerItem {
  latitude: number;
  longitude: number;
  title?: string;
  color?: string;
  type?: 'driver' | 'destination' | 'default';
}

interface OSMMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  markers?: MarkerItem[];
}

/**
 * Componente de Mapa 100% nativo OpenStreetMap (Leaflet) via WebView.
 * Não depende do Google Play Services, nunca trava nem fecha por falta de API Key.
 */
export function OSMMap({ latitude, longitude, zoom = 15, markers = [] }: OSMMapProps) {
  const serializedMarkers = JSON.stringify(markers);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: #0F172A;
          }
          .leaflet-control-attribution {
            font-size: 8px;
            background: rgba(15, 23, 42, 0.7) !important;
            color: #94A3B8 !important;
          }
          .leaflet-control-attribution a {
            color: #F59E0B !important;
          }
          .pulse-dot {
            background-color: #F59E0B;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 3px solid #0F172A;
            box-shadow: 0 0 12px rgba(245, 158, 11, 0.9);
          }
          .car-badge {
            background-color: #0F172A;
            border: 2px solid #F59E0B;
            border-radius: 16px;
            padding: 3px 8px;
            font-size: 12px;
            font-weight: 600;
            color: #F8FAFC;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
          }
          .dest-badge {
            background-color: #EF4444;
            border: 2px solid #FFFFFF;
            border-radius: 50%;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(239, 68, 68, 0.6);
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: true
          }).setView([${latitude}, ${longitude}], ${zoom});

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          // Marcador do Passageiro (localização atual)
          var passengerIcon = L.divIcon({
            className: 'custom-pin',
            html: '<div class="pulse-dot"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });
          L.marker([${latitude}, ${longitude}], { icon: passengerIcon }).addTo(map).bindPopup('Você está aqui');

          var extraMarkers = ${serializedMarkers};
          var allPoints = [[${latitude}, ${longitude}]];

          extraMarkers.forEach(function(m) {
            var icon;
            if (m.type === 'driver') {
              icon = L.divIcon({
                className: 'car-icon',
                html: '<div class="car-badge">🚗 ' + (m.title || 'Motorista') + '</div>',
                iconSize: [100, 26],
                iconAnchor: [50, 13]
              });
            } else if (m.type === 'destination') {
              icon = L.divIcon({
                className: 'dest-icon',
                html: '<div class="dest-badge">🏁</div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11]
              });
            }

            var marker = icon ? L.marker([m.latitude, m.longitude], { icon: icon }) : L.marker([m.latitude, m.longitude]);
            marker.addTo(map);
            if (m.title) {
              marker.bindPopup(m.title);
            }
            allPoints.push([m.latitude, m.longitude]);
          });

          // Ajusta zoom caso tenha destino para mostrar toda a rota
          if (extraMarkers.some(function(m) { return m.type === 'destination'; })) {
            map.fitBounds(L.latLngBounds(allPoints), { padding: [60, 60], maxZoom: 16 });
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text style={styles.loadingText}>Carregando OpenStreetMap...</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 10,
    fontSize: 13,
  },
});
