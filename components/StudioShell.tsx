"use client";

import { useState } from "react";
import { SettingsProvider } from "@/components/SettingsProvider";
import PipelineRail from "@/components/PipelineRail";
import SettingsDrawer from "@/components/SettingsDrawer";
import LangBar from "@/components/LangBar";
import Placeholder from "@/components/stages/Placeholder";
import ConceptStage from "@/components/stages/ConceptStage";
import CopyStage from "@/components/stages/CopyStage";
import ImageStage from "@/components/stages/ImageStage";
import VoiceStage from "@/components/stages/VoiceStage";
import VideoStage from "@/components/stages/VideoStage";
import SubtitleStage from "@/components/stages/SubtitleStage";
import OverlayStage from "@/components/stages/OverlayStage";
import { STAGES, StageId, StageStatus } from "@/lib/stages";

export default function StudioShell() {
  const [active, setActive] = useState<StageId>("concept");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<StageId, StageStatus>>(
    () => Object.fromEntries(STAGES.map((s) => [s.id, "empty"])) as Record<StageId, StageStatus>
  );

  const setStageStatus = (id: StageId, st: StageStatus) =>
    setStatuses((prev) => (prev[id] === st ? prev : { ...prev, [id]: st }));

  const activeStage = STAGES.find((s) => s.id === active)!;
  const activeIndex = STAGES.findIndex((s) => s.id === active);

  function renderStage() {
    switch (active) {
      case "concept":
        return <ConceptStage onStatus={(s) => setStageStatus("concept", s)} />;
      case "copy":
        return <CopyStage onStatus={(s) => setStageStatus("copy", s)} />;
      case "images":
        return <ImageStage onStatus={(s) => setStageStatus("images", s)} />;
      case "voice":
        return <VoiceStage onStatus={(s) => setStageStatus("voice", s)} />;
      case "video":
        return <VideoStage onStatus={(s) => setStageStatus("video", s)} />;
      case "subtitles":
        return <SubtitleStage onStatus={(s) => setStageStatus("subtitles", s)} />;
      case "overlay":
        return <OverlayStage onStatus={(s) => setStageStatus("overlay", s)} />;
      default:
        return <Placeholder stage={activeStage} index={activeIndex} />;
    }
  }

  return (
    <SettingsProvider>
      <div className="app">
        <header className="app-topbar">
          <div className="brand">
            <span className="brand__mark" />
            <span className="brand__name">
              <b>Pikaluna</b> Studio
            </span>
          </div>
          <div className="topbar__spacer" />
          <LangBar />
          <span className="project-tag">projekt · neimenovan</span>
          <button className="icon-btn" aria-label="Nastavitve" onClick={() => setSettingsOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
            </svg>
          </button>
        </header>

        <div className="app-body">
          <PipelineRail active={active} statuses={statuses} onSelect={setActive} />
          <main>{renderStage()}</main>
        </div>

        {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}
      </div>
    </SettingsProvider>
  );
}
