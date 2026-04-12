import { TTRParams } from "@/app/types/match";

export function getCoinsForRow(row: number, params?: TTRParams): number {
    if (!params) return row === 0 ? 2 : row === 1 ? 3 : row === 2 ? 4 : 5;

    if (row === 0) return params.level1.coins;
    if (row === 1) return params.level2.coins;
    if (row === 2) return params.level3.coins;
    return params.level4?.coins ?? 5;
}
