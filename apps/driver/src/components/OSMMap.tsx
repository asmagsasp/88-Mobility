import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
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
  autoFollowCar?: boolean;
}

const CustomWebView = WebView as any;

/**
 * Componente de Mapa estilo Google Maps via OpenStreetMap (Leaflet + Carto Voyager).
 * - Renderização suave com estilo visual limpo (Google Maps)
 * - Rastreamento contínuo da câmera no veículo durante navegação
 * - Botão de recentralizar (🎯) estilo Google Maps quando o motorista arrasta o mapa
 * - Controles de Zoom (+/-)
 * - Traçado de rota estilo Google Maps (Azul vibrante com contorno)
 */
export function OSMMap({
  latitude,
  longitude,
  zoom = 17,
  carPosition,
  routeCoordinates = [],
  markers = [],
  autoFollowCar = true,
}: OSMMapProps) {
  const webViewRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showRecenter, setShowRecenter] = useState(false);

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
              background-color: #E2E8F0;
              overflow: hidden;
            }
            .leaflet-control-attribution {
              font-size: 8px;
              background: rgba(255, 255, 255, 0.75) !important;
              color: #64748B !important;
            }

            /* Carrinho 99 com rotação suave */
            .car-99-wrap {
              position: relative;
              width: 38px;
              height: 64px;
              transition: transform 0.4s ease-out;
              transform-origin: center center;
            }
            .car-99-svg {
              width: 38px;
              height: 64px;
              filter: drop-shadow(0 6px 12px rgba(0,0,0,0.45));
            }

            /* Marcador de Passageiro estilo Google */
            .passenger-pin {
              background-color: #10B981;
              border: 3px solid #FFFFFF;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 14px rgba(16, 185, 129, 0.65);
              font-size: 16px;
              animation: pulse-passenger 2s infinite;
            }
            @keyframes pulse-passenger {
              0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.75); }
              70% { box-shadow: 0 0 0 16px rgba(16, 185, 129, 0); }
              100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }

            /* Marcador de Destino */
            .dest-pin {
              background-color: #EF4444;
              border: 3px solid #FFFFFF;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 14px rgba(239, 68, 68, 0.65);
              font-size: 16px;
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

            // Camada de mapa OpenStreetMap 100% gratuita, estável e sem exigência de API Key
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            var carMarker = null;
            var routeBorder = null;
            var routeInner = null;
            var markersGroup = L.layerGroup().addTo(map);
            var userDragging = false;

            // Detecta quando o motorista arrasta o mapa manualmente
            map.on('dragstart', function() {
              userDragging = true;
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_DRAG' }));
              }
            });

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
              iconSize: [38, 64],
              iconAnchor: [19, 32]
            });

            // 1. Atualizar posição do carrinho e acompanhar a câmera estilo Google Maps
            window.updateCarPosition = function(newLat, newLng, heading, autoFollow) {
              if (!carMarker) {
                carMarker = L.marker([newLat, newLng], { icon: carIcon, zIndexOffset: 3000 }).addTo(map);
              } else {
                carMarker.setLatLng([newLat, newLng]);
              }
              var carEl = document.getElementById('car-99-element');
              if (carEl) {
                carEl.style.transform = 'rotate(' + (heading || 0) + 'deg)';
              }

              // Acompanha a câmera automaticamente pelo GPS caso o usuário não tenha arrastado manualmente
              if (autoFollow && !userDragging) {
                map.panTo([newLat, newLng], { animate: true, duration: 0.8, easeLinearity: 0.3 });
              }
            };

            // 2. Traçado da rota estilo Google Maps (Azul Vivo com borda suave)
            window.updateRoute = function(rawCoords) {
              if (routeBorder) { map.removeLayer(routeBorder); routeBorder = null; }
              if (routeInner) { map.removeLayer(routeInner); routeInner = null; }

              if (!rawCoords || rawCoords.length < 2) return;

              // Borda externa escura
              routeBorder = L.polyline(rawCoords, {
                color: '#1E3A8A',
                weight: 8,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);

              // Linha principal Azul Google Maps
              routeInner = L.polyline(rawCoords, {
                color: '#3B82F6',
                weight: 5.5,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);

              if (!userDragging) {
                map.fitBounds(L.latLngBounds(rawCoords), { padding: [60, 60], maxZoom: 17 });
              }
            };

            // 3. Atualizar marcadores extras (passageiro e destino)
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
                  iconHtml = '<div style="background:#F59E0B;width:18px;height:18px;border-radius:50%;border:2px solid #fff;"></div>';
                }

                var icon = L.divIcon({
                  className: className,
                  html: iconHtml,
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
                });

                var mk = L.marker([m.latitude, m.longitude], { icon: icon });
                if (m.title) mk.bindPopup(m.title);
                markersGroup.addLayer(mk);
              });
            };

            // 4. Centralizar no carro (comportamento idêntico ao botão 🎯 do Google Maps)
            window.recenterCar = function() {
              userDragging = false;
              if (carMarker) {
                map.setView(carMarker.getLatLng(), 17, { animate: true });
              }
            };

            // 5. Controles de Zoom
            window.zoomIn = function() { map.zoomIn(); };
            window.zoomOut = function() { map.zoomOut(); };

            setTimeout(function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
              }
            }, 300);
          </script>
        </body>
      </html>
    `;
  }, []);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_READY') {
        setMapReady(true);
      } else if (data.type === 'USER_DRAG') {
        setShowRecenter(true);
      }
    } catch {}
  };

  const recenter = () => {
    setShowRecenter(false);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('window.recenterCar(); true;');
    }
  };

  const handleZoomIn = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('window.zoomIn(); true;');
    }
  };

  const handleZoomOut = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('window.zoomOut(); true;');
    }
  };

  // Atualiza posição do carrinho e segue a câmera
  useEffect(() => {
    if (carPosition && webViewRef.current) {
      const js = `
        if (window.updateCarPosition) {
          window.updateCarPosition(
            ${carPosition.latitude},
            ${carPosition.longitude},
            ${carPosition.heading || 0},
            ${autoFollowCar ? 'true' : 'false'}
          );
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [carPosition?.latitude, carPosition?.longitude, carPosition?.heading, autoFollowCar, mapReady]);

  // Atualiza rota
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

  // Atualiza marcadores
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
            <Text style={styles.loadingText}>Carregando navegação GPS estilo Google Maps...</Text>
          </View>
        )}
      />

      {/* Controles Flutuantes estilo Google Maps */}
      <View style={styles.floatingControls}>
        <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn} activeOpacity={0.8}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut} activeOpacity={0.8}>
          <Text style={styles.zoomText}>−</Text>
        </TouchableOpacity>
      </View>

      {/* Botão Recentralizar (🎯) estilo Google Maps */}
      {showRecenter && (
        <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.85}>
          <Text style={styles.recenterIcon}>🎯</Text>
          <Text style={styles.recenterText}>Centralizar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#E2E8F0',
  },
  webview: {
    flex: 1,
    backgroundColor: '#E2E8F0',
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
  floatingControls: {
    position: 'absolute',
    right: 14,
    top: 130,
    gap: 8,
    zIndex: 999,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  zoomText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 26,
  },
  recenterBtn: {
    position: 'absolute',
    right: 14,
    bottom: 120,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  recenterIcon: {
    fontSize: 18,
  },
  recenterText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
});
