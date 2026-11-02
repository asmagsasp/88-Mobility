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
  isSearching?: boolean;
  searchRadiusKm?: number;
}

const CustomWebView = WebView as any;

/**
 * Componente de Mapa OpenStreetMap (Leaflet) via WebView no App do Passageiro.
 * Inclui:
 * - Círculo animado e ondas de radar estilo 99 para busca de motoristas em até 10 km
 * - Carrinho animado estilo 99 se movendo suavemente pelo trajeto
 * - 100% estável via injeção JavaScript, sem recarregar o WebView nem piscar a tela
 */
export function OSMMap({
  latitude,
  longitude,
  zoom = 15,
  markers = [],
  carPosition,
  routeCoordinates = [],
  isSearching = false,
  searchRadiusKm = 10,
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
              box-shadow: 0 0 14px rgba(16, 185, 129, 0.9);
              z-index: 100;
              position: relative;
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

            /* Marcador de destino final com alfinete vermelho e endereço com número */
            .dest-pin-wrapper {
              display: flex;
              flex-direction: column;
              align-items: center;
              transform: translate(-50%, -100%);
              pointer-events: none;
            }
            .dest-title-pill {
              background: #0F172A;
              color: #FFFFFF;
              font-size: 11px;
              font-weight: 700;
              padding: 4px 10px;
              border-radius: 14px;
              border: 1.5px solid #EF4444;
              white-space: nowrap;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
              margin-bottom: 4px;
              max-width: 240px;
              overflow: hidden;
              text-overflow: ellipsis;
              text-align: center;
            }
            .dest-badge {
              background-color: #EF4444;
              border: 2px solid #FFFFFF;
              border-radius: 50%;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(239, 68, 68, 0.7);
              font-size: 14px;
            }

            /* ========================================================= */
            /* CÍRCULO E ONDAS DE RADAR ESTILO 99 (BUSCA ATÉ 10 KM)      */
            /* ========================================================= */
            .radar-container {
              position: relative;
              width: 260px;
              height: 260px;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: none;
            }
            .radar-ring {
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              border: 2px solid rgba(245, 158, 11, 0.85);
              background: radial-gradient(circle, rgba(245, 158, 11, 0.28) 0%, rgba(245, 158, 11, 0.08) 55%, transparent 100%);
              animation: radar-expand 2.6s infinite cubic-bezier(0.1, 0.6, 0.4, 1);
              box-shadow: 0 0 20px rgba(245, 158, 11, 0.45);
            }
            .radar-ring-1 { animation-delay: 0s; }
            .radar-ring-2 { animation-delay: 0.85s; }
            .radar-ring-3 { animation-delay: 1.7s; }

            @keyframes radar-expand {
              0% {
                transform: scale(0.12);
                opacity: 0.95;
                border-width: 3.5px;
              }
              50% {
                opacity: 0.65;
              }
              100% {
                transform: scale(3.2);
                opacity: 0;
                border-width: 1px;
              }
            }

            .radar-sonar-sweep {
              position: absolute;
              width: 160px;
              height: 160px;
              border-radius: 50%;
              background: conic-gradient(from 0deg, rgba(245, 158, 11, 0.45) 0deg, rgba(245, 158, 11, 0.08) 60deg, transparent 90deg);
              animation: radar-spin 3.2s linear infinite;
            }
            @keyframes radar-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }

            /* Mini carros parceiros ao redor sendo escaneados */
            .nearby-driver-pin {
              width: 24px;
              height: 24px;
              background-color: #0F172A;
              border: 1.8px solid #F59E0B;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              box-shadow: 0 3px 10px rgba(0,0,0,0.6);
              animation: driver-blip 1.6s infinite alternate ease-in-out;
            }
            @keyframes driver-blip {
              0% { transform: scale(0.9); opacity: 0.65; }
              100% { transform: scale(1.18); opacity: 1; filter: drop-shadow(0 0 7px #F59E0B); }
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

            // Variáveis do Radar de Busca (estilo 99)
            var radarCircle = null;
            var radarPulseMarker = null;
            var nearbyDriversGroup = L.layerGroup().addTo(map);

            // Marcador do Passageiro (Você está aqui)
            var passengerIcon = L.divIcon({
              className: 'passenger-custom-pin',
              html: '<div class="passenger-pulse-dot"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            var userMarker = L.marker([${latitude}, ${longitude}], { icon: passengerIcon, zIndexOffset: 1000 }).addTo(map).bindPopup('Ponto de Embarque (Você)');

            // Atualiza a posição real do passageiro e recentraliza o mapa
            window.updateUserLocation = function(newLat, newLng, shouldCenter) {
              if (userMarker) {
                userMarker.setLatLng([newLat, newLng]);
              }
              if (shouldCenter && map) {
                map.setView([newLat, newLng], map.getZoom() || 15, { animate: true });
              }
            };

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

            // 3. Atualizar marcadores extras (Destino com alfinete vermelho e número)
            window.updateMarkers = function(markersList) {
              markersGroup.clearLayers();
              if (!markersList || markersList.length === 0) return;

              markersList.forEach(function(m) {
                if (m.type === 'destination') {
                  var titleSafe = m.title ? m.title.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
                  var pillHtml = titleSafe ? '<div class="dest-title-pill">📍 ' + titleSafe + '</div>' : '';
                  var destIcon = L.divIcon({
                    className: 'dest-pin-container',
                    html: '<div class="dest-pin-wrapper">' + pillHtml + '<div class="dest-badge">🏁</div></div>',
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                  });
                  var mk = L.marker([m.latitude, m.longitude], { icon: destIcon, zIndexOffset: 900 });
                  if (m.title) mk.bindPopup(m.title);
                  markersGroup.addLayer(mk);
                }
              });
            };

            // 4. Ativar/Desativar Radar Animado estilo 99 (até 10 km)
            window.setSearchingRadar = function(isSearching, radiusKm) {
              var rKm = radiusKm || 10;
              var radiusMeters = rKm * 1000;
              var curCenter = userMarker ? userMarker.getLatLng() : L.latLng(${latitude}, ${longitude});

              if (!isSearching) {
                if (radarCircle) { map.removeLayer(radarCircle); radarCircle = null; }
                if (radarPulseMarker) { map.removeLayer(radarPulseMarker); radarPulseMarker = null; }
                nearbyDriversGroup.clearLayers();
                return;
              }

              // A. Círculo geográfico no mapa com o raio exato de 10 km
              if (!radarCircle) {
                radarCircle = L.circle(curCenter, {
                  radius: radiusMeters,
                  color: '#F59E0B',
                  weight: 2,
                  dashArray: '8, 8',
                  fillColor: '#F59E0B',
                  fillOpacity: 0.08
                }).addTo(map);
              } else {
                radarCircle.setLatLng(curCenter);
              }

              // B. Ondas de Radar e Sonar pulsante concêntrico (estilo 99)
              if (!radarPulseMarker) {
                var radarHtml = \`
                  <div class="radar-container">
                    <div class="radar-sonar-sweep"></div>
                    <div class="radar-ring radar-ring-1"></div>
                    <div class="radar-ring radar-ring-2"></div>
                    <div class="radar-ring radar-ring-3"></div>
                  </div>
                \`;
                var radarIcon = L.divIcon({
                  className: 'radar-leaflet-icon',
                  html: radarHtml,
                  iconSize: [260, 260],
                  iconAnchor: [130, 130]
                });
                radarPulseMarker = L.marker(curCenter, { icon: radarIcon, interactive: false, zIndexOffset: 500 }).addTo(map);
              } else {
                radarPulseMarker.setLatLng(curCenter);
              }

              // C. Mini carrinhos de motoristas parceiros pontilhados ao redor simulando escaneamento
              nearbyDriversGroup.clearLayers();
              var driversNearby = [
                { dLat: 0.007, dLng: 0.006, title: 'Motorista parceiro a 1.2 km' },
                { dLat: -0.008, dLng: 0.007, title: 'Motorista parceiro a 2.3 km' },
                { dLat: 0.012, dLng: -0.009, title: 'Motorista parceiro a 3.5 km' },
                { dLat: -0.015, dLng: -0.012, title: 'Motorista parceiro a 5.1 km' },
                { dLat: 0.022, dLng: 0.018, title: 'Motorista parceiro a 7.8 km' }
              ];

              driversNearby.forEach(function(d) {
                var driverMiniIcon = L.divIcon({
                  className: 'nearby-driver-wrap',
                  html: '<div class="nearby-driver-pin">🚗</div>',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                });
                var dm = L.marker([curCenter.lat + d.dLat, curCenter.lng + d.dLng], { icon: driverMiniIcon, zIndexOffset: 800 });
                if (d.title) dm.bindPopup(d.title);
                nearbyDriversGroup.addLayer(dm);
              });

              // Centraliza e ajusta visão suavemente
              map.setView(curCenter, 14);
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

  // Atualiza o radar animado estilo 99 (busca de motoristas em até 10 km)
  useEffect(() => {
    if (webViewRef.current) {
      const js = `
        if (window.setSearchingRadar) {
          window.setSearchingRadar(${isSearching ? 'true' : 'false'}, ${searchRadiusKm || 10});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [isSearching, searchRadiusKm, mapReady]);

  // Atualiza a posição real do passageiro e recentraliza o mapa quando sem rota ativa
  useEffect(() => {
    if (webViewRef.current && mapReady && latitude && longitude) {
      const shouldCenter = routeCoordinates.length === 0;
      const js = `
        if (window.updateUserLocation) {
          window.updateUserLocation(${latitude}, ${longitude}, ${shouldCenter ? 'true' : 'false'});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [latitude, longitude, mapReady, routeCoordinates.length]);

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
