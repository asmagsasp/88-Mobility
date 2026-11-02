import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MarkerItem {
  latitude: number;
  longitude: number;
  title?: string;
  type?: 'passenger' | 'destination' | 'default';
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
  carPosition?: CarPosition | null;
  routeCoordinates?: RouteCoordinate[];
  markers?: MarkerItem[];
}

const CustomWebView = WebView as any;

/**
 * Componente de Mapa OpenStreetMap (Leaflet) via WebView.
 * Carrega a página Web UMA ÚNICA VEZ e atualiza a rota e o carrinho estilo 99
 * exclusivamente via injeção JavaScript. NUNCA recarrega nem pisca a tela.
 */
export function OSMMap({
  latitude,
  longitude,
  zoom = 16,
  carPosition,
  routeCoordinates = [],
  markers = [],
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

            /* Carrinho 99 */
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
              filter: drop-shadow(0 6px 10px rgba(0,0,0,0.55));
            }

            /* Marcador de Passageiro */
            .passenger-pin {
              background-color: #10B981;
              border: 3px solid #FFFFFF;
              border-radius: 50%;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.6);
              font-size: 14px;
              animation: pulse-passenger 2s infinite;
            }
            @keyframes pulse-passenger {
              0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
              70% { box-shadow: 0 0 0 14px rgba(16, 185, 129, 0); }
              100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }

            /* Marcador de Destino */
            .dest-pin {
              background-color: #EF4444;
              border: 3px solid #FFFFFF;
              border-radius: 50%;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6);
              font-size: 14px;
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

            // SVG oficial do Carrinho do 99
            var carSvgHtml = \`
              <div id="car-99-element" class="car-99-wrap" style="transform: rotate(0deg);">
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

            // 1. Atualizar posição do carrinho sem recarregar o mapa
            window.updateCarPosition = function(newLat, newLng, heading) {
              if (!carMarker) {
                carMarker = L.marker([newLat, newLng], { icon: carIcon }).addTo(map);
              } else {
                carMarker.setLatLng([newLat, newLng]);
              }
              var carEl = document.getElementById('car-99-element');
              if (carEl) {
                carEl.style.transform = 'rotate(' + (heading || 0) + 'deg)';
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

              map.fitBounds(L.latLngBounds(rawCoords), { padding: [70, 70], maxZoom: 17 });
            };

            // 3. Atualizar marcadores extras
            window.updateMarkers = function(markersList) {
              markersGroup.clearLayers();
              if (!markersList || markersList.length === 0) return;

              markersList.forEach(function(m) {
                var iconHtml = '';
                var className = '';
                if (m.type === 'passenger') {
                  iconHtml = '<div class="passenger-pin">👤</div>';
                  className = 'passenger-marker';
                } else if (m.type === 'destination') {
                  iconHtml = '<div class="dest-pin">🏁</div>';
                  className = 'dest-marker';
                } else {
                  iconHtml = '<div style="background:#F59E0B;width:16px;height:16px;border-radius:50%;border:2px solid #fff;"></div>';
                }

                var icon = L.divIcon({
                  className: className,
                  html: iconHtml,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14]
                });

                var mk = L.marker([m.latitude, m.longitude], { icon: icon });
                if (m.title) mk.bindPopup(m.title);
                markersGroup.addLayer(mk);
              });
            };

            // 4. Centralizar mapa na localização real do motorista
            window.centerMap = function(newLat, newLng, newZoom) {
              if (map) {
                map.setView([newLat, newLng], newZoom || 16, { animate: true });
              }
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
      const js = `
        if (window.updateCarPosition) {
          window.updateCarPosition(${carPosition.latitude}, ${carPosition.longitude}, ${carPosition.heading || 0});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [carPosition?.latitude, carPosition?.longitude, carPosition?.heading, mapReady]);

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

  // Centraliza o mapa na localização real do motorista sempre que o GPS atualizar (quando sem rota ativa)
  useEffect(() => {
    if (webViewRef.current && mapReady && latitude && longitude) {
      if (routeCoordinates.length === 0) {
        const js = `
          if (window.centerMap) {
            window.centerMap(${latitude}, ${longitude}, ${zoom});
          }
          if (window.updateCarPosition && !${carPosition ? 'true' : 'false'}) {
            window.updateCarPosition(${latitude}, ${longitude}, 0);
          }
          true;
        `;
        webViewRef.current.injectJavaScript(js);
      }
    }
  }, [latitude, longitude, zoom, mapReady, routeCoordinates.length]);

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
            <Text style={styles.loadingText}>Carregando navegação GPS...</Text>
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
    fontWeight: '600',
  },
});
