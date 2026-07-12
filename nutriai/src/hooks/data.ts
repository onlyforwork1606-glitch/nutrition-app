import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getAllMeals,
  getMealsByDate,
  putMeal,
  deleteMeal,
  getAllWeight,
  putWeight,
  deleteWeight,
  getWaterByDate,
  putWater,
  deleteWater,
  getFavorites,
  putFavorite,
  deleteFavorite,
  getUsage,
} from "@/lib/db";
import type { Meal, WeightLog, WaterLog } from "@/lib/types";
import { todayKey } from "@/lib/utils";

/* ------------------------------ Meals ------------------------------ */

export function useMealsByDate(date: string): UseQueryResult<Meal[]> {
  return useQuery({
    queryKey: ["meals", date],
    queryFn: () => getMealsByDate(date),
  });
}

export function useAllMeals(): UseQueryResult<Meal[]> {
  return useQuery({ queryKey: ["meals", "all"], queryFn: getAllMeals });
}

export function useSaveMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meal: Meal) => putMeal(meal),
    onSuccess: (_, meal) => {
      qc.invalidateQueries({ queryKey: ["meals", meal.date] });
      qc.invalidateQueries({ queryKey: ["meals", "all"] });
    },
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meal: Meal) => deleteMeal(meal.id),
    onSuccess: (_, meal) => {
      qc.invalidateQueries({ queryKey: ["meals", meal.date] });
      qc.invalidateQueries({ queryKey: ["meals", "all"] });
    },
  });
}

/* ------------------------------ Weight ----------------------------- */

export function useWeightHistory(): UseQueryResult<WeightLog[]> {
  return useQuery({ queryKey: ["weight"], queryFn: getAllWeight });
}

export function useSaveWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (log: WeightLog) => putWeight(log),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight"] }),
  });
}

export function useDeleteWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWeight(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight"] }),
  });
}

/* ------------------------------ Water ------------------------------ */

export function useWaterByDate(date: string): UseQueryResult<WaterLog[]> {
  return useQuery({
    queryKey: ["water", date],
    queryFn: () => getWaterByDate(date),
  });
}

export function useAddWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (log: WaterLog) => putWater(log),
    onSuccess: (_, log) => qc.invalidateQueries({ queryKey: ["water", log.date] }),
  });
}

export function useDeleteWaterLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (log: WaterLog) => deleteWater(log.id),
    onSuccess: (_, log) => qc.invalidateQueries({ queryKey: ["water", log.date] }),
  });
}

/* ----------------------------- Favorites --------------------------- */

export function useFavorites() {
  return useQuery({ queryKey: ["favorites"], queryFn: getFavorites });
}

export function useSaveFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putFavorite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteFavorite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });
}

export { todayKey };

/* ------------------------------ Usage ---------------------------------- */

export function useUsage(date: string) {
  return useQuery({
    queryKey: ["usage", date],
    queryFn: () => getUsage(date),
  });
}
