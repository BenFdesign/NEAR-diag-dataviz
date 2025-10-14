import { useMemo } from "react";
import { fetchMobilityByZoneData } from "~/lib/datapacks/DpMobilityByZone";

export function useMobilityByZone(suId: string) {
  const result = useMemo(() => {
    try {
      const suIdNum = parseInt(suId, 10);
      const data = fetchMobilityByZoneData(isNaN(suIdNum) ? [] : [suIdNum]);
      return {
        data,
        loading: false,
        error: null,
      };
    } catch (e) {
      return {
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : "Erreur inconnue",
      };
    }
  }, [suId]);

  return result;
}
