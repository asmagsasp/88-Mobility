import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MarkerItem {
  latitude: number;
  longitude: number;
  title?: string;
  color?: string;
  type?: 'driver' | 'destination' | 'default';
}

export interface CarPosition {
  latitude: number;
  longitude: number;
  heading?: number;
  label?: string;
}

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

interface OSMMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  markers?: MarkerItem[];
  carPosition?: CarPosition | null;
  routeCoordinates?: RouteCoordinate[];
}

/**
 * Componente de Mapa OpenStreetMap (Leaflet) via WebView no App do Passageiro.
 * Exibe o carrinho semelhante ao do 99 se movendo suavemente pelo trajeto até o passageiro.
 */
const CustomWebView = WebView as any;

export function OSMMap({
  latitude,
  longitude,
  zoom = 15,
  markers = [],
  carPosition,
  routeCoordinates = [],
}: OSMMapProps) {
  const webViewRef = useRef<any>(null);

  const serializedMarkers = JSON.stringify(markers);
  const serializedRoute = JSON.stringify(routeCoordinates.map((c) => [c.latitude, c.longitude]));
  const serializedCar = JSON.stringify(carPosition || null);

  // Atualiza posição do carrinho instantaneamente via JS injection sem recarregar a tela
  useEffect(() => {
    if (carPosition && webViewRef.current) {
      const js = `
        if (window.updatePassengerCar) {
          window.updatePassengerCar(${carPosition.latitude}, ${carPosition.longitude}, ${carPosition.heading || 0});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [carPosition?.latitude, carPosition?.longitude, carPosition?.heading]);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * {
            box-sizing: border-box;
            user-select: none;
            -webkit-user-select: none;
          }
          body, html, #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: #0F172A;
            overflow: hidden;
          }
          .leaflet-control-attribution {
            font-size: 8px;
            background: rgba(15, 23, 42, 0.75) !important;
            color: #94A3B8 !important;
          }
          .leaflet-control-attribution a {
            color: #F59E0B !important;
          }

          /* Ponto pulsante do passageiro */
          .passenger-pulse-dot {
            background-color: #10B981;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid #FFFFFF;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.9);
            animation: pulse-green 1.8s infinite;
          }
          @keyframes pulse-green {
            0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8); }
            70% { transform: scale(1.1); box-shadow: 0 0 0 16px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }

          /* Carrinho 99 Top-Down */
          .car-99-wrap {
            position: relative;
            width: 36px;
            height: 60px;
            transition: transform 0.4s ease-out;
            transform-origin: center center;
          }
          .car-99-svg {
            width: 36px;
            height: 60px;
            filter: drop-shadow(0 6px 12px rgba(0,0,0,0.6));
          }

          /* Badge elegante com nome do motorista */
          .driver-badge-top {
            position: absolute;
            top: -26px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #0F172A;
            border: 1.5px solid #F59E0B;
            border-radius: 12px;
            padding: 2px 7px;
            font-size: 10px;
            font-weight: 700;
            color: #F8FAFC;
            white-space: nowrap;
            box-shadow: 0 3px 8px rgba(0,0,0,0.6);
            pointer-events: none;
          }

          /* Marcador de destino final */
          .dest-badge {
            background-color: #EF4444;
            border: 2px solid #FFFFFF;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(239, 68, 68, 0.6);
            font-size: 12px;
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

          var allPoints = [[${latitude}, ${longitude}]];
          var rawRoute = ${serializedRoute};
          var carData = ${serializedCar};

          // 1. Linha do Trajeto (Polyline)
          if (rawRoute && rawRoute.length > 1) {
            L.polyline(rawRoute, {
              color: '#0F172A',
              weight: 8,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);

            L.polyline(rawRoute, {
              color: '#F59E0B',
              weight: 5,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);

            rawRoute.forEach(function(pt) { allPoints.push(pt); });
          }

          // 2. Marcador do Passageiro (Você está aqui)
          var passengerIcon = L.divIcon({
            className: 'passenger-custom-pin',
            html: '<div class="passenger-pulse-dot"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          L.marker([${latitude}, ${longitude}], { icon: passengerIcon }).addTo(map).bindPopup('Ponto de Embarque (Você)');

          // 3. Marcador de Destino se houver
          var extraMarkers = ${serializedMarkers};
          extraMarkers.forEach(function(m) {
            if (m.type === 'destination') {
              var destIcon = L.divIcon({
                className: 'dest-icon',
                html: '<div class="dest-badge">🏁</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });
              L.marker([m.latitude, m.longitude], { icon: destIcon }).addTo(map).bindPopup(m.title || 'Destino');
              allPoints.push([m.latitude, m.longitude]);
            }
          });

          // 4. Marcador do Carrinho Semelhante ao 99 (Top-Down Amarelo com badge)
          var carMarker = null;
          var carHtml = \`
            <div id="passenger-car-element" class="car-99-wrap" style="transform: rotate(0deg);">
              <div class="driver-badge-top">\${(carData && carData.label) ? carData.label : 'Abel · 99'}</div>
              <svg class="car-99-svg" viewBox="0 0 34 58" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Rodas Pretas -->
                <rect x="1" y="9" width="3" height="9" rx="1.5" fill="#0F172A"/>
                <rect x="30" y="9" width="3" height="9" rx="1.5" fill="#0F172A"/>
                <rect x="1" y="40" width="3" height="9" rx="1.5" fill="#0F172A"/>
                <rect x="30" y="40" width="3" height="9" rx="1.5" fill="#0F172A"/>

                <!-- Carroceria Amarelo Ouro 99 -->
                <rect x="3" y="3" width="28" height="52" rx="10" fill="#FFC800" stroke="#D97706" stroke-width="1.5"/>

                <!-- Retrovisores Laterais -->
                <path d="M0 15 C0 13.5, 3 13.5, 3 16 L3 19 C3 20.5, 0 20.5, 0 19 Z" fill="#FFC800" stroke="#D97706" stroke-width="0.8"/>
                <path d="M34 15 C34 13.5, 31 13.5, 31 16 L31 19 C31 20.5, 34 20.5, 34 19 Z" fill="#FFC800" stroke="#D97706" stroke-width="0.8"/>

                <!-- Faróis Dianteiros LED -->
                <ellipse cx="8" cy="6" rx="2.5" ry="1.5" fill="#FFFFFF"/>
                <ellipse cx="26" cy="6" rx="2.5" ry="1.5" fill="#FFFFFF"/>
                <circle cx="8" cy="6" r="4" fill="#FEF08A" opacity="0.6"/>
                <circle cx="26" cy="6" r="4" fill="#FEF08A" opacity="0.6"/>

                <!-- Capô Dianteiro -->
                <path d="M7 11 L27 11" stroke="#EAB308" stroke-width="1" stroke-linecap="round"/>

                <!-- Para-brisa Dianteiro Fumê -->
                <path d="M6 16 C9 13.5, 25 13.5, 28 16 L25 24 L9 24 Z" fill="#0F172A"/>

                <!-- Teto com Emblema Oficial 88 -->
                <rect x="7" y="25" width="20" height="18" rx="3" fill="#F59E0B"/>
                <text x="17" y="38" font-size="10" font-family="system-ui, sans-serif" font-weight="900" fill="#0F172A" text-anchor="middle">88</text>

                <!-- Para-brisa Traseiro -->
                <path d="M8 44 L10 49 C14 50, 20 50, 24 49 L26 44 Z" fill="#0F172A"/>

                <!-- Lanternas Traseiras Vermelhas -->
                <rect x="5" y="52" width="5" height="2.5" rx="1" fill="#DC2626"/>
                <rect x="24" y="52" width="5" height="2.5" rx="1" fill="#DC2626"/>
              </svg>
            </div>
          \`;

          if (carData) {
            var carIcon = L.divIcon({
              className: 'car-99-leaflet-icon',
              html: carHtml,
              iconSize: [36, 60],
              iconAnchor: [18, 30]
            });
            carMarker = L.marker([carData.latitude, carData.longitude], { icon: carIcon }).addTo(map);
            allPoints.push([carData.latitude, carData.longitude]);
          }

          // Função chamada para mover o carrinho em tempo real
          window.updatePassengerCar = function(newLat, newLng, heading) {
            if (carMarker) {
              carMarker.setLatLng([newLat, newLng]);
              var carEl = document.getElementById('passenger-car-element');
              if (carEl) {
                carEl.style.transform = 'rotate(' + heading + 'deg)';
              }
            }
          };

          // Ajusta zoom
          if (allPoints.length > 1) {
            map.fitBounds(L.latLngBounds(allPoints), { padding: [60, 60], maxZoom: 16 });
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <CustomWebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text style={styles.loadingText}>Carregando mapa em tempo real...</Text>
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
