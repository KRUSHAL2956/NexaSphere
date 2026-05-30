/**
 * Shared roadmap type definitions
 * Centralizes types used across roadmapParser.ts and RoadmapBuilder.tsx
 */

export interface StaticResource {
  title: string;
  url: string;
}

export interface StaticNode {
  id: string;
  label: string;
  description: string;
  concepts?: string[];
  docs?: string;
  tutorials?: StaticResource[];
  practice?: StaticResource[];
}

export interface StaticRoadmap {
  title: string;
  description: string;
  nodes: StaticNode[];
}

export type RoadmapDataMap = Record<string, StaticRoadmap>;
