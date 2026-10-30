/**
 * NeuroForge API configuration
 */
import { NEUROFORGE_URL } from "./endpoints";

export const neuroforgeConfig = {
  baseUrl: NEUROFORGE_URL,
  apiVersion: "v1",
};

export function getApiUrl(path: string): string {
  return `${neuroforgeConfig.baseUrl}/api/${neuroforgeConfig.apiVersion}${path}`;
}
