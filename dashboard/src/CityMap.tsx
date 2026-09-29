import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { scaleLinear } from "d3-scale";
import "leaflet/dist/leaflet.css";
import { loadBoundaries, tiers, tierKey, signed, type Zip } from "./data";

export default function CityMap({
  zips,
  selected,
  onSelect,
  mode = "tier",
  dark,
  hero = false,
}: {
  zips: Zip[];
  selected?: string;
  onSelect?: (zip: string) => void;
  mode?: "tier" | "housing";
  dark: boolean;
  hero?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tileError, setTileError] = useState(false);
  const selection = useRef(onSelect);
  selection.current = onSelect;
  useEffect(() => {
    if (!ref.current) return;
    let alive = true;
    setError("");
    setLoading(true);
    setTileError(false);
    const map = L.map(ref.current, {
      zoomSnap: 0.25,
      zoomControl: !hero,
      scrollWheelZoom: false,
      dragging: !hero,
      doubleClickZoom: !hero,
      touchZoom: !hero,
      keyboard: !hero,
      attributionControl: true,
    }).setView([32.83, -96.8], 10);
    mapRef.current = map;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 18,
        className: "street-tile",
      })
        .on("tileerror", () => {
          if (alive) setTileError(true);
        })
        .addTo(map);
    if (hero) map.attributionControl.addAttribution("US Census ZIP boundaries");
    const colors = {
      high: dark ? "#9ec5f4" : "#104281",
      moderate: dark ? "#3987e5" : "#2a78d6",
      maintenance: dark ? "#184f95" : "#86b6ef",
      neutral: dark ? "#2c2c2a" : "#e1e0d9",
      red: dark ? "#e66767" : "#e34948",
      blue: dark ? "#3987e5" : "#2a78d6",
    };
    const gapColor = scaleLinear<string>()
      .domain([-24, 0, 20])
      .range([colors.red, dark ? "#383835" : "#f0efec", colors.blue])
      .clamp(true);
    loadBoundaries()
      .then((geo) => {
        if (!alive) return;
        const layer = L.geoJSON(geo, {
          style: (feature) => {
            const z = zips.find(
              (z) => z.zip_code === feature?.properties?.zip_code,
            );
            const eligible =
              z &&
              (mode === "tier"
                ? z.is_in_dallas && z.has_enough_permits
                : z.income_rank != null);
            const fill = !eligible
              ? colors.neutral
              : mode === "tier"
                ? colors[tierKey(z!.development_tier)]
                : gapColor(z!.beats_income_by!);
            return {
              fillColor: fill,
              fillOpacity: 0.82,
              color:
                selected === z?.zip_code
                  ? "#eb6834"
                  : dark
                    ? "#575752"
                    : "#ffffff",
              weight: selected === z?.zip_code ? 3 : 1,
              opacity: 1,
            };
          },
          onEachFeature: (feature, layer) => {
            const zip = String(feature.properties?.zip_code);
            const z = zips.find((z) => z.zip_code === zip);
            const tooltip = document.createElement("span");
            tooltip.textContent = `${zip} · ${!z || (mode === "tier" ? !z.is_in_dallas || !z.has_enough_permits : z.income_rank == null) ? "Not compared" : mode === "tier" ? z.development_tier : `${signed(z.beats_income_by)} places vs income`}`;
            layer.bindTooltip(tooltip, { sticky: true });
            if (!hero) layer.on("click", () => selection.current?.(zip));
          },
        }).addTo(map);
        const studyFeatures = geo.features.filter((f) =>
          zips.some(
            (z) =>
              z.zip_code === f.properties?.zip_code &&
              z.is_in_dallas &&
              z.has_enough_permits,
          ),
        );
        const studyGeo = { ...geo, features: studyFeatures };
        map.fitBounds(L.geoJSON(studyGeo).getBounds(), {
          padding: hero ? [16, 16] : [20, 20],
          animate: false,
        });
        if (!hero)
          layer.eachLayer((l) => {
            const path = (l as L.Path).getElement();
            const zip = (
              l as L.Layer & { feature: { properties: { zip_code: string } } }
            ).feature.properties.zip_code;
            if (path) {
              path.setAttribute("tabindex", "0");
              path.setAttribute("role", "button");
              path.setAttribute("aria-label", `Open ZIP ${zip}`);
              path.addEventListener("keydown", (event) => {
                const key = (event as KeyboardEvent).key;
                if (key === "Enter" || key === " ") {
                  event.preventDefault();
                  selection.current?.(zip);
                }
              });
              path.addEventListener("focus", () => l.openTooltip());
              path.addEventListener("blur", () => l.closeTooltip());
            }
          });
        setLoading(false);
      })
      .catch(() => {
        if (alive) {
          setError(
            "Map boundaries could not load. Use the ZIP search or list to explore the same data.",
          );
          setLoading(false);
        }
      });
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ animate: false }),
    );
    observer.observe(ref.current);
    return () => {
      alive = false;
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [zips, mode, dark, hero]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hero) return;
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON)
        layer.eachLayer((l) => {
          const feature = (
            l as L.Layer & { feature?: { properties: { zip_code: string } } }
          ).feature;
          (l as L.Path).setStyle({
            color:
              feature?.properties.zip_code === selected
                ? "#eb6834"
                : dark
                  ? "#575752"
                  : "#ffffff",
            weight: feature?.properties.zip_code === selected ? 3 : 1,
          });
          if (feature?.properties.zip_code === selected)
            (l as L.Path).bringToFront();
        });
    });
  }, [selected, dark, hero]);
  return (
    <div className={`map-shell ${hero ? "hero-map" : ""}`}>
      <div
        className="map-canvas"
        ref={ref}
        role="region"
        aria-label="Dallas ZIP boundary map"
      />
      {loading && (
        <div className="map-status" role="status">
          Loading Dallas boundaries…
        </div>
      )}
      {error && (
        <div className="map-status" role="alert">
          {error}
        </div>
      )}
      {tileError && !error && (
        <div className="tile-note">
          Street tiles unavailable. ZIP boundaries remain usable.
        </div>
      )}
      {(
        <div className="map-caption">
          <span className="eyebrow">DALLAS, TEXAS</span>
          <span>ZIP boundaries · study period</span>
        </div>
      )}
      <div className="map-legend">
        {mode === "tier" ? (
          tiers.map((tier) => (
            <span key={tier}>
              <i className={`${tierKey(tier)}-fill`} />
              {tier}
            </span>
          ))
        ) : (
          <>
            <span>
              <i className="negative-fill" />
              Below income rank
            </span>
            <span>
              <i className="moderate-fill" />
              Above income rank
            </span>
          </>
        )}
        {(
          <span>
            <i className="neutral-fill" />
            Not compared
          </span>
        )}
      </div>
    </div>
  );
}
