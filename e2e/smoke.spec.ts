import { test, expect } from "@playwright/test";

/**
 * Smoke test — pastikan setiap halaman utama bisa terbuka dan menampilkan
 * konten intinya. Read-only: tidak mengisi form atau menyimpan data apa pun,
 * jadi aman dijalankan berkali-kali tanpa mengubah data di Supabase.
 */

test("Dashboard menampilkan ringkasan & menu utama", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Menu Utama")).toBeVisible();
});

test("Inventori menampilkan daftar barang", async ({ page }) => {
  await page.goto("/inventori");
  await expect(page.getByRole("heading", { name: "Daftar Barang (Inventori)" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tambah/ }).first()).toBeVisible();
});

test("POS menampilkan form transaksi", async ({ page }) => {
  await page.goto("/pos");
  await expect(page.getByRole("heading", { name: "Point of Sales" })).toBeVisible();
  await expect(page.getByText("Detail Barang")).toBeVisible();
});

test("Keuangan menampilkan gerbang PIN (tidak mencoba membuka)", async ({ page }) => {
  await page.goto("/keuangan");
  await expect(page.getByText("Halaman Keuangan")).toBeVisible();
  await expect(page.getByText("Masukkan PIN untuk melanjutkan")).toBeVisible();
});

test("Hutang & Piutang menampilkan daftar", async ({ page }) => {
  await page.goto("/hutang-piutang");
  await expect(page.getByRole("heading", { name: "Hutang & Piutang Usaha" })).toBeVisible();
});

test("Pegadaian menampilkan daftar gadai", async ({ page }) => {
  await page.goto("/pegadaian");
  await expect(page.getByRole("heading", { name: "Gadai Emas" })).toBeVisible();
});

test("Servis menampilkan daftar servis", async ({ page }) => {
  await page.goto("/servis");
  await expect(page.getByRole("heading", { name: "Servis Perhiasan" })).toBeVisible();
});
