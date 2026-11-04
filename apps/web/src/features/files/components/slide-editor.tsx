"use client";
import { useState } from "react";
import type { PresentationContent, Slide } from "../types";
export function SlideEditor({
  content,
  onChange,
  readOnly,
}: {
  content: PresentationContent;
  onChange: (value: PresentationContent) => void;
  readOnly: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, content.slides.length - 1));
  const slide = content.slides[index];
  const update = (patch: Partial<Slide>) =>
    onChange({
      ...content,
      slides: content.slides.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    });
  const move = (direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= content.slides.length) return;
    const slides = [...content.slides];
    [slides[index], slides[target]] = [slides[target], slides[index]];
    onChange({ ...content, slides });
    setSelected(target);
  };
  const addImage = (file?: File) => {
    if (
      !file ||
      !/^image\/(png|jpeg|gif|webp)$/.test(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      window.alert("Choose a PNG, JPEG, GIF, or WebP image under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ image: String(reader.result) });
    reader.readAsDataURL(file);
  };
  return (
    <div className="file-slide-editor">
      <div className="file-toolbar">
        <label>
          Theme{" "}
          <select
            value={content.theme}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                ...content,
                theme: e.target.value as PresentationContent["theme"],
              })
            }
          >
            <option value="paper">Paper</option>
            <option value="midnight">Midnight</option>
            <option value="ocean">Ocean</option>
          </select>
        </label>
        <button
          disabled={readOnly || content.slides.length >= 100}
          onClick={() => {
            onChange({
              ...content,
              slides: [
                ...content.slides,
                {
                  id: crypto.randomUUID(),
                  title: "New slide",
                  body: "Add your ideas",
                  layout: "content",
                },
              ],
            });
            setSelected(content.slides.length);
          }}
        >
          + Slide
        </button>
        <button disabled={readOnly || index === 0} onClick={() => move(-1)}>
          Move earlier
        </button>
        <button
          disabled={readOnly || index === content.slides.length - 1}
          onClick={() => move(1)}
        >
          Move later
        </button>
        <button
          disabled={readOnly || content.slides.length < 2}
          onClick={() => {
            onChange({
              ...content,
              slides: content.slides.filter((_, i) => i !== index),
            });
            setSelected(Math.max(0, index - 1));
          }}
        >
          Delete slide
        </button>
      </div>
      <div className="file-slide-layout">
        <nav className="file-slide-thumbs" aria-label="Slides">
          {content.slides.map((item, i) => (
            <button
              key={item.id}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setSelected(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {item.title || "Untitled slide"}
            </button>
          ))}
        </nav>
        {slide && (
          <div className="file-slide-main">
            <div
              className={`file-slide-canvas theme-${content.theme} layout-${slide.layout}`}
            >
              <div>
                <input
                  aria-label="Slide title"
                  value={slide.title}
                  readOnly={readOnly}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="Slide title"
                />
                <textarea
                  aria-label="Slide body"
                  value={slide.body}
                  readOnly={readOnly}
                  onChange={(e) => update({ body: e.target.value })}
                  placeholder="Tell your story"
                />
              </div>
              {slide.image && (
                <div
                  className="file-slide-image"
                  style={{
                    backgroundImage: `url("${slide.image.replace(/["\\\n\r]/g, "")}")`,
                    left: `${Math.min(66, slide.x ?? 56.25)}%`,
                    top: `${Math.min(60, slide.y ?? 26.67)}%`,
                  }}
                  role="img"
                  aria-label="Slide image"
                />
              )}
              <span className="file-slide-number">
                {index + 1} / {content.slides.length}
              </span>
            </div>
            <div className="file-slide-controls">
              <label>
                Layout{" "}
                <select
                  disabled={readOnly}
                  value={slide.layout}
                  onChange={(e) =>
                    update({ layout: e.target.value as Slide["layout"] })
                  }
                >
                  <option value="title">Title</option>
                  <option value="content">Content</option>
                  <option value="split">Split</option>
                </select>
              </label>
              <label className="file-button">
                Add image
                <input
                  type="file"
                  disabled={readOnly}
                  hidden
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(e) => {
                    addImage(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {slide.image && (
                <>
                  <button
                    disabled={readOnly}
                    onClick={() => update({ image: undefined })}
                  >
                    Remove image
                  </button>
                  <label>
                    Image X{" "}
                    <input
                      aria-label="Image horizontal position"
                      disabled={readOnly}
                      type="range"
                      min="0"
                      max="66"
                      value={slide.x ?? 56.25}
                      onChange={(e) => update({ x: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Image Y{" "}
                    <input
                      aria-label="Image vertical position"
                      disabled={readOnly}
                      type="range"
                      min="0"
                      max="60"
                      value={slide.y ?? 26.67}
                      onChange={(e) => update({ y: Number(e.target.value) })}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
