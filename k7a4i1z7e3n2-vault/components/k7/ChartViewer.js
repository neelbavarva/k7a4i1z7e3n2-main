"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { ChevronLeft, ChevronRight, LoaderCircle, X, ZoomIn, ZoomOut } from "lucide-react";

/**
 * Chart snapshots full screen, over the rest of the site. The arrows (or ← →) and the strip
 * below move between charts. Clicking a chart zooms in around that spot; drag or scroll
 * to look around, click again to fit it back. Esc, ✕ or a click on the dark closes.
 * `shots` is [[label, src], ...]; `index` is the one showing, or null when closed.
 */
export default function ChartViewer({ shots, index, title, sub, onIndex, onClose }) {
    const open = index != null && !!shots[index];
    const [zoom, setZoom] = useState(null); // { src, w, aim }: zoomed width in px, and where to centre
    const [loaded, setLoaded] = useState({}); // src -> "ok" | "error"
    const stage = useRef(null);
    const img = useRef(null);
    const drag = useRef(null);
    const dragged = useRef(false);

    const [label, src] = open ? shots[index] : ["", ""];
    const zoomW = zoom?.src === src ? zoom.w : 0; // moving to another chart starts it fitted
    const many = shots.length > 1;
    const go = (d) => onIndex((index + d + shots.length) % shots.length);
    const close = () => {
        setZoom(null); // the next chart opened starts fitted
        onClose();
    };

    // zoom to twice the fitted size, keeping the point that was clicked in the middle
    const zoomAt = (fx, fy) => {
        const r = img.current?.getBoundingClientRect();
        if (r) setZoom({ src, w: Math.round(r.width * 2), aim: [fx, fy] });
    };
    useLayoutEffect(() => {
        const s = stage.current;
        const i = img.current;
        if (!zoomW || !zoom?.aim || !s || !i) return;
        s.scrollLeft = i.offsetLeft + zoom.aim[0] * i.offsetWidth - s.clientWidth / 2;
        s.scrollTop = i.offsetTop + zoom.aim[1] * i.offsetHeight - s.clientHeight / 2;
    }, [zoomW, zoom]);

    const onClick = (e) => {
        if (dragged.current) {
            dragged.current = false;
            return;
        }
        if (e.target === img.current) {
            if (zoomW) return setZoom(null);
            const r = img.current.getBoundingClientRect();
            return zoomAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }
        if (!zoomW) close(); // the dark around a fitted chart
    };

    // with a mouse, a zoomed chart pans by dragging; touch scrolls it natively
    const onPointerDown = (e) => {
        if (!zoomW || e.pointerType !== "mouse" || e.button !== 0) return;
        e.preventDefault();
        drag.current = { x: e.clientX, y: e.clientY, l: stage.current.scrollLeft, t: stage.current.scrollTop, moved: false };
    };
    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        stage.current.scrollLeft = d.l - dx;
        stage.current.scrollTop = d.t - dy;
    };
    const endDrag = () => {
        dragged.current = !!drag.current?.moved;
        drag.current = null;
    };

    const state = loaded[src];
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
            <Dialog.Portal>
                <Dialog.Overlay className="viewer">
                    <Dialog.Content
                        className="viewer-in"
                        aria-describedby={undefined}
                        onKeyDown={(e) => {
                            if (!many) return;
                            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                                e.preventDefault();
                                go(e.key === "ArrowRight" ? 1 : -1);
                            }
                        }}
                    >
                        {open && (
                            <>
                                <div className="viewer-bar">
                                    <div className="viewer-head">
                                        <Dialog.Title className="viewer-title">
                                            {title} <span>{label} chart</span>
                                        </Dialog.Title>
                                        {sub && <p className="viewer-sub">{sub}</p>}
                                    </div>
                                    {many && (
                                        <span className="viewer-count num-tab">
                                            {index + 1} / {shots.length}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="viewer-btn"
                                        onClick={() => (zoomW ? setZoom(null) : zoomAt(0.5, 0.5))}
                                        disabled={state !== "ok"}
                                        aria-label={zoomW ? "Fit to screen" : "Zoom in"}
                                        title={zoomW ? "Fit to screen" : "Zoom in"}
                                    >
                                        {zoomW ? <ZoomOut /> : <ZoomIn />}
                                    </button>
                                    <Dialog.Close asChild>
                                        <button type="button" className="viewer-btn" aria-label="Close" title="Close (Esc)">
                                            <X />
                                        </button>
                                    </Dialog.Close>
                                </div>

                                <div className="viewer-main">
                                    <div
                                        ref={stage}
                                        className={`viewer-stage${zoomW ? " is-zoomed" : ""}`}
                                        onClick={onClick}
                                        onPointerDown={onPointerDown}
                                        onPointerMove={onPointerMove}
                                        onPointerUp={endDrag}
                                        onPointerLeave={() => (drag.current = null)}
                                    >
                                        {/* the full snapshot as it is, not a resized copy, so it stays sharp when zoomed */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            key={src}
                                            ref={img}
                                            src={src}
                                            alt={`${title} ${label} chart`}
                                            draggable="false"
                                            className={state === "ok" ? "" : "is-loading"}
                                            style={zoomW ? { width: zoomW } : undefined}
                                            onLoad={() => setLoaded((m) => ({ ...m, [src]: "ok" }))}
                                            onError={() => setLoaded((m) => ({ ...m, [src]: "error" }))}
                                        />
                                    </div>
                                    {state !== "ok" && (
                                        <div className="viewer-wait" role="status">
                                            {state === "error" ? (
                                                "This chart couldn’t be loaded."
                                            ) : (
                                                <>
                                                    <LoaderCircle className="spin" aria-hidden="true" />
                                                    <span className="visually-hidden">Loading chart</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {many && (
                                        <>
                                            <button type="button" className="viewer-btn viewer-nav is-prev" onClick={() => go(-1)} aria-label="Previous chart">
                                                <ChevronLeft />
                                            </button>
                                            <button type="button" className="viewer-btn viewer-nav is-next" onClick={() => go(1)} aria-label="Next chart">
                                                <ChevronRight />
                                            </button>
                                        </>
                                    )}
                                </div>

                                {many && (
                                    <div className="viewer-strip">
                                        {shots.map(([l, s], i) => (
                                            <button
                                                key={l}
                                                type="button"
                                                className="viewer-thumb"
                                                aria-current={i === index}
                                                aria-label={`${l} chart`}
                                                onClick={() => onIndex(i)}
                                            >
                                                <Image src={s} alt="" width={224} height={126} sizes="112px" />
                                                <span>{l}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </Dialog.Content>
                </Dialog.Overlay>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
