import React, { useRef, useEffect, useState, useMemo } from 'react';
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

const CustomWebView = WebView as any;

/**
 * Componente de Mapa OpenStreetMap (Leaflet) via WebView no App do Passageiro.
 * Carrega a página Web UMA ÚNICA VEZ e atualiza a rota e o carrinho estilo 99
 * exclusivamente via injeção JavaScript. NUNCA recarrega nem pisca a tela.
 */
export function OSMMap({
  latitude,
  longitude,
  zoom = 15,
  markers = [],
  carPosition,
  routeCoordinates = [],
}: OSMMapProps) {
  const webViewRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Inicializa o HTML do Leaflet uma única vez (estável, sem causar reload da WebView)
  const initialHtml = useMemo(() => {
    return `
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
              transition: transform 0.3s ease-out;
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

            var carMarker = null;
            var routeBorder = null;
            var routeInner = null;
            var markersGroup = L.layerGroup().addTo(map);

            // Marcador Fixo do Passageiro (Você está aqui)
            var passengerIcon = L.divIcon({
              className: 'passenger-custom-pin',
              html: '<div class="passenger-pulse-dot"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            L.marker([${latitude}, ${longitude}], { icon: passengerIcon }).addTo(map).bindPopup('Ponto de Embarque (Você)');

            // SVG do Carrinho do 99
            var carSvgHtml = \`
              <div id="passenger-car-element" class="car-99-wrap" style="transform: rotate(0deg);">
                <div id="driver-badge-text" class="driver-badge-top">Abel · 99</div>
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

            var carIcon = L.divIcon({
              className: 'car-99-leaflet-icon',
              html: carSvgHtml,
              iconSize: [36, 60],
              iconAnchor: [18, 30]
            });

            // 1. Atualizar posição e rotação do carrinho sem recarregar o mapa
            window.updatePassengerCar = function(newLat, newLng, heading, label) {
              if (!carMarker) {
                carMarker = L.marker([newLat, newLng], { icon: carIcon }).addTo(map);
              } else {
                carMarker.setLatLng([newLat, newLng]);
              }
              var carEl = document.getElementById('passenger-car-element');
              if (carEl) {
                carEl.style.transform = 'rotate(' + (heading || 0) + 'deg)';
              }
              if (label) {
                var badgeEl = document.getElementById('driver-badge-text');
                if (badgeEl) badgeEl.innerText = label;
              }
            };

            // 2. Atualizar rota (Polyline) sem recarregar o mapa
            window.updateRoute = function(rawCoords) {
              if (routeBorder) { map.removeLayer(routeBorder); routeBorder = null; }
              if (routeInner) { map.removeLayer(routeInner); routeInner = null; }

              if (!rawCoords || rawCoords.length < 2) return;

              routeBorder = L.polyline(rawCoords, {
                color: '#0F172A',
                weight: 8,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);

              routeInner = L.polyline(rawCoords, {
                color: '#F59E0B',
                weight: 5,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);

              map.fitBounds(L.latLngBounds(rawCoords), { padding: [60, 60], maxZoom: 16 });
            };

            // 3. Atualizar marcadores extras (Destino)
            window.updateMarkers = function(markersList) {
              markersGroup.clearLayers();
              if (!markersList || markersList.length === 0) return;

              markersList.forEach(function(m) {
                if (m.type === 'destination') {
                  var destIcon = L.divIcon({
                    className: 'dest-icon',
                    html: '<div class="dest-badge">🏁</div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                  });
                  var mk = L.marker([m.latitude, m.longitude], { icon: destIcon });
                  if (m.title) mk.bindPopup(m.title);
                  markersGroup.addLayer(mk);
                }
              });
            };

            // Avisa o React Native que o mapa Leaflet está pronto
            setTimeout(function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
              }
            }, 300);
          </script>
        </body>
      </html>
    `;
  }, []); // Executado UMA ÚNICA VEZ. Nunca recria o HTML nem recarrega o WebView!

  // Quando o mapa sinaliza que carregou
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_READY') {
        setMapReady(true);
      }
    } catch {
      // Ignora erro de parse
    }
  };

  // Atualiza posição do carrinho de forma fluida sem recarregar o mapa
  useEffect(() => {
    if (carPosition && webViewRef.current) {
      const label = carPosition.label || 'Abel · 99';
      const js = `
        if (window.updatePassengerCar) {
          window.updatePassengerCar(${carPosition.latitude}, ${carPosition.longitude}, ${carPosition.heading || 0}, ${JSON.stringify(label)});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [carPosition?.latitude, carPosition?.longitude, carPosition?.heading, carPosition?.label, mapReady]);

  // Atualiza rota (Polyline) de forma fluida sem recarregar o mapa
  useEffect(() => {
    if (webViewRef.current) {
      const raw = routeCoordinates.map((c) => [c.latitude, c.longitude]);
      const js = `
        if (window.updateRoute) {
          window.updateRoute(${JSON.stringify(raw)});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [routeCoordinates, mapReady]);

  // Atualiza marcadores de forma fluida sem recarregar o mapa
  useEffect(() => {
    if (webViewRef.current) {
      const js = `
        if (window.updateMarkers) {
          window.updateMarkers(${JSON.stringify(markers)});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [markers, mapReady]);

  return (
    <View style={styles.container}>
      <CustomWebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: initialHtml }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
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
