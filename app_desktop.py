import csv
import ctypes
import os
import re
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# Módulo de elasticidad del acero estructural (Pytel-Singer Tabla B-1: 200 GPa = 200,000 MPa)[cite: 3]
E_ACERO = 200_000.0


def obtener_ruta_recurso(nombre_archivo):
    """Obtiene la ruta absoluta del archivo en ejecución normal o empaquetado por PyInstaller."""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, nombre_archivo)
    return os.path.join(os.path.abspath("."), nombre_archivo)


class OptiSteelApp:

    def __init__(self, root):
        self.root = root
        self.root.title(
            "OptiSteel Pro — Selector y Optimizador de Vigas de Acero"
        )
        self.root.geometry("1200x750")
        self.root.minsize(1050, 660)

        # ==============================================================================
        # ASIGNACIÓN DE ICONO (BARRA DE TAREAS Y TÍTULO)
        # ==============================================================================
        ruta_png = obtener_ruta_recurso("icono.png")
        ruta_ico = obtener_ruta_recurso("icono.ico")

        # 1. Tkinter nativo lee PNG perfectamente para reemplazar la pluma azul
        if os.path.exists(ruta_png):
            try:
                self.icono_img = tk.PhotoImage(file=ruta_png)
                self.root.iconphoto(True, self.icono_img)
            except Exception:
                pass
        # 2. Respaldo por si solo existe el archivo .ico
        elif os.path.exists(ruta_ico):
            try:
                self.root.iconbitmap(ruta_ico)
            except Exception:
                pass

        # Carga del catálogo CSV
        self.ruta_csv_actual = obtener_ruta_recurso(
            "perfiles_estructurales.csv"
        )
        self.catalogo = self.cargar_datos(self.ruta_csv_actual)

        self.configurar_tema()
        self.construir_interfaz()

    def cargar_datos(self, ruta):
        if not os.path.exists(ruta):
            messagebox.showinfo(
                "Catálogo requerido",
                f"No se localizó el archivo:\n'{ruta}'\n\nPor favor selecciona el catálogo CSV.",
                parent=self.root,
            )
            ruta_sel = filedialog.askopenfilename(
                title="Seleccionar catálogo CSV",
                filetypes=[
                    ("Archivos CSV", "*.csv"),
                    ("Todos los archivos", "*.*"),
                ],
                parent=self.root,
            )
            if not ruta_sel:
                messagebox.showerror(
                    "Error",
                    "No se seleccionó ningún catálogo. La aplicación se cerrará.",
                    parent=self.root,
                )
                self.root.destroy()
                sys.exit(0)
            ruta = ruta_sel

        perfiles = []
        try:
            with open(ruta, mode="r", encoding="utf-8") as f:
                lector = csv.DictReader(f)
                columnas_requeridas = {
                    "tipo",
                    "designacion",
                    "masa_kg_m",
                    "d_mm",
                    "tw_mm",
                    "Ix_10e6_mm4",
                    "Sx_10e3_mm3",
                }

                if not columnas_requeridas.issubset(
                    set(lector.fieldnames or [])
                ):
                    faltantes = columnas_requeridas - set(
                        lector.fieldnames or []
                    )
                    messagebox.showerror(
                        "Error de formato CSV",
                        f"Faltan columnas requeridas en el CSV:\n{', '.join(faltantes)}",
                        parent=self.root,
                    )
                    self.root.destroy()
                    sys.exit(0)

                for r in lector:
                    perfiles.append(
                        {
                            "tipo": r["tipo"].strip().upper(),
                            "designacion": r["designacion"].strip(),
                            "masa": float(r["masa_kg_m"]),
                            "d": float(r["d_mm"]),
                            "tw": float(r["tw_mm"]),
                            "Ix": float(r["Ix_10e6_mm4"]),
                            "Sx": float(r["Sx_10e3_mm3"]),
                        }
                    )

            self.ruta_csv_actual = os.path.basename(ruta)
            return perfiles

        except Exception as e:
            messagebox.showerror(
                "Error al leer catálogo",
                f"Ocurrió un error al procesar el archivo CSV:\n{str(e)}",
                parent=self.root,
            )
            self.root.destroy()
            sys.exit(0)

    def recargar_otro_csv(self):
        ruta_nueva = filedialog.askopenfilename(
            title="Seleccionar nuevo catálogo de perfiles",
            filetypes=[
                ("Archivos CSV", "*.csv"),
                ("Todos los archivos", "*.*"),
            ],
            parent=self.root,
        )
        if ruta_nueva:
            nuevo_catalogo = self.cargar_datos(ruta_nueva)
            if nuevo_catalogo:
                self.catalogo = nuevo_catalogo
                self.lbl_status.config(
                    text=f"Catálogo activo: {len(self.catalogo)} perfiles ({self.ruta_csv_actual})"
                )
                messagebox.showinfo(
                    "Catálogo actualizado",
                    f"Se cargaron exitosamente {len(self.catalogo)} perfiles.",
                    parent=self.root,
                )

    def configurar_tema(self):
        self.COLOR_BG = "#0f172a"
        self.COLOR_PANEL = "#1e293b"
        self.COLOR_CARD = "#334155"
        self.COLOR_PRIMARY = "#3b82f6"
        self.COLOR_PRIMARY_HOVER = "#2563eb"
        self.COLOR_TEXT = "#f8fafc"
        self.COLOR_MUTED = "#94a3b8"
        self.COLOR_ACCENT = "#10b981"

        self.root.configure(bg=self.COLOR_BG)

        self.root.option_add("*TCombobox*Listbox.background", "#0f172a")
        self.root.option_add("*TCombobox*Listbox.foreground", "#f8fafc")
        self.root.option_add("*TCombobox*Listbox.selectBackground", "#2563eb")
        self.root.option_add("*TCombobox*Listbox.selectForeground", "#ffffff")
        self.root.option_add("*TCombobox*Listbox.font", ("Segoe UI", 9))
        self.root.option_add("*TCombobox*Listbox.relief", "flat")
        self.root.option_add("*TCombobox*Listbox.borderWidth", "0")

        style = ttk.Style()
        style.theme_use("clam")

        style.configure(
            "TFrame", background=self.COLOR_BG, borderwidth=0, relief="flat"
        )
        style.configure(
            "Panel.TFrame",
            background=self.COLOR_PANEL,
            relief="flat",
            borderwidth=0,
        )
        style.configure(
            "Card.TFrame",
            background=self.COLOR_CARD,
            relief="flat",
            borderwidth=0,
        )

        style.configure(
            "TLabel",
            background=self.COLOR_PANEL,
            foreground=self.COLOR_TEXT,
            font=("Segoe UI", 10),
        )
        style.configure(
            "Muted.TLabel",
            background=self.COLOR_PANEL,
            foreground=self.COLOR_MUTED,
            font=("Segoe UI", 8),
        )
        style.configure(
            "CardTitle.TLabel",
            background=self.COLOR_CARD,
            foreground=self.COLOR_MUTED,
            font=("Segoe UI", 9, "bold"),
        )
        style.configure(
            "CardVal.TLabel",
            background=self.COLOR_CARD,
            foreground=self.COLOR_TEXT,
            font=("Segoe UI", 15, "bold"),
        )
        style.configure(
            "CardSub.TLabel",
            background=self.COLOR_CARD,
            foreground=self.COLOR_MUTED,
            font=("Segoe UI", 8),
        )

        style.configure(
            "TEntry",
            fieldbackground="#0f172a",
            foreground="#f8fafc",
            insertcolor="#f8fafc",
            bordercolor="#475569",
            lightcolor="#3b82f6",
            darkcolor="#475569",
            padding=6,
        )

        style.configure(
            "TCombobox",
            fieldbackground="#0f172a",
            background="#1e293b",
            foreground="#f8fafc",
            darkcolor="#1e293b",
            lightcolor="#1e293b",
            arrowcolor="#f8fafc",
            bordercolor="#475569",
            padding=6,
        )

        style.map(
            "TCombobox",
            fieldbackground=[
                ("readonly", "#0f172a"),
                ("focus", "#0f172a"),
                ("!disabled", "#0f172a"),
            ],
            foreground=[
                ("readonly", "#f8fafc"),
                ("focus", "#f8fafc"),
                ("!disabled", "#f8fafc"),
            ],
            background=[("readonly", "#1e293b"), ("active", "#334155")],
            arrowcolor=[("readonly", "#f8fafc"), ("active", "#3b82f6")],
            selectbackground=[("readonly", "#0f172a"), ("focus", "#2563eb")],
            selectforeground=[("readonly", "#f8fafc"), ("focus", "#ffffff")],
        )

        style.configure(
            "Treeview",
            background="#1e293b",
            foreground="#f8fafc",
            fieldbackground="#1e293b",
            font=("Segoe UI", 9),
            rowheight=26,
            borderwidth=0,
        )
        style.configure(
            "Treeview.Heading",
            background="#0f172a",
            foreground="#94a3b8",
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            padding=6,
        )
        style.map("Treeview.Heading", background=[("active", "#1e293b")])
        style.map(
            "Treeview",
            background=[("selected", "#2563eb")],
            foreground=[("selected", "#ffffff")],
        )

    def construir_interfaz(self):
        main_box = ttk.Frame(self.root)
        main_box.pack(fill="both", expand=True, padx=14, pady=14)

        # ---------------- PANEL IZQUIERDO ----------------
        sidebar = ttk.Frame(main_box, style="Panel.TFrame", width=380)
        sidebar.pack(side="left", fill="y", padx=(0, 14))
        sidebar.pack_propagate(False)

        lbl_titulo = tk.Label(
            sidebar,
            text="OptiSteel",
            font=("Segoe UI", 18, "bold"),
            bg=self.COLOR_PANEL,
            fg="#ffffff",
        )
        lbl_titulo.pack(anchor="w", padx=20, pady=(18, 2))

        lbl_sub = tk.Label(
            sidebar,
            text="Pytel-Singer Structural Engine (Standalone)",
            font=("Segoe UI", 8),
            bg=self.COLOR_PANEL,
            fg=self.COLOR_MUTED,
        )
        lbl_sub.pack(anchor="w", padx=20, pady=(0, 14))

        opciones_flecha = [
            "360 | L/360: NSR-10 C.9.5(b) & IBC Tab. 1604.3 (Pisos L)",
            "240 | L/240: NSR-10 C.9.5(b) & AISC DG-3 (Pisos D+L)",
            "180 | L/180: IBC Tab. 1604.3 & NSR-10 (Cubiertas)",
            "480 | L/480: NSR-10 C.9.5(b) & ACI 318 (Acabados frágiles)",
            "600 | L/600: AISC Design Guide 3 (Fachadas mampostería)",
        ]

        self.entradas = {}
        campos = [
            (
                "Tipo de Perfil",
                "tipo",
                "W",
                ["W (Ala Ancha)", "S (Vigas I)", "C (Canales)", "TODOS"],
            ),
            ("Momento externo M (kN·m)", "M_ext", "150.0", None),
            ("Cortante externo V (kN)", "V_ext", "75.0", None),
            ("Longitud viga L (m)", "L_m", "6.0", None),
            ("Esfuerzo admisible σ (MPa)", "sigma_adm", "140.0", None),
            (
                "Límite de flecha (Norma / Uso)",
                "flecha",
                opciones_flecha[0],
                opciones_flecha,
            ),
        ]

        for etiqueta, key, defecto, opciones in campos:
            f = ttk.Frame(sidebar, style="Panel.TFrame")
            f.pack(fill="x", padx=20, pady=4)

            lbl = ttk.Label(f, text=etiqueta)
            lbl.pack(anchor="w", pady=(0, 2))

            if opciones:
                cb = ttk.Combobox(f, values=opciones, state="readonly")
                cb.set(opciones[0] if key in ["tipo", "flecha"] else defecto)
                cb.pack(fill="x")
                self.entradas[key] = cb
            else:
                ent = ttk.Entry(f)
                ent.insert(0, defecto)
                ent.pack(fill="x")
                self.entradas[key] = ent

        btn_calc = tk.Button(
            sidebar,
            text="OPTIMIZAR PERFIL",
            font=("Segoe UI", 10, "bold"),
            bg=self.COLOR_PRIMARY,
            fg="#ffffff",
            activebackground=self.COLOR_PRIMARY_HOVER,
            activeforeground="#ffffff",
            relief="flat",
            cursor="hand2",
            command=self.calcular,
        )
        btn_calc.pack(fill="x", padx=20, pady=(16, 6))

        btn_csv = tk.Button(
            sidebar,
            text="📂 Cargar otro catálogo CSV",
            font=("Segoe UI", 8),
            bg=self.COLOR_CARD,
            fg=self.COLOR_TEXT,
            activebackground="#475569",
            activeforeground="#ffffff",
            relief="flat",
            cursor="hand2",
            command=self.recargar_otro_csv,
        )
        btn_csv.pack(fill="x", padx=20, pady=(0, 8))

        self.lbl_status = tk.Label(
            sidebar,
            text=f"Catálogo: {len(self.catalogo)} perfiles ({self.ruta_csv_actual})",
            font=("Segoe UI", 8),
            bg=self.COLOR_PANEL,
            fg=self.COLOR_MUTED,
        )
        self.lbl_status.pack(side="bottom", pady=10)

        # ---------------- PANEL DERECHO ----------------
        right_panel = ttk.Frame(main_box)
        right_panel.pack(side="right", fill="both", expand=True)

        self.card_optimo = ttk.Frame(right_panel, style="Card.TFrame")
        self.card_optimo.pack(fill="x", pady=(0, 14))

        header_card = ttk.Frame(self.card_optimo, style="Card.TFrame")
        header_card.pack(fill="x", padx=20, pady=(15, 8))

        lbl_card_title = tk.Label(
            header_card,
            text="PERFIL ÓPTIMO SELECCIONADO",
            font=("Segoe UI", 9, "bold"),
            bg=self.COLOR_CARD,
            fg=self.COLOR_ACCENT,
        )
        lbl_card_title.pack(side="left")

        self.lbl_banner_perfil = tk.Label(
            self.card_optimo,
            text="Presione 'Optimizar Perfil' para calcular",
            font=("Segoe UI", 20, "bold"),
            bg=self.COLOR_CARD,
            fg=self.COLOR_TEXT,
        )
        self.lbl_banner_perfil.pack(anchor="w", padx=20, pady=(0, 10))

        card_subgrid = ttk.Frame(self.card_optimo, style="Card.TFrame")
        card_subgrid.pack(fill="x", padx=20, pady=(0, 15))

        self.res_masa = self.crear_subcard(
            card_subgrid, "Masa lineal", "—", "kg/m", 0
        )
        self.res_sigma = self.crear_subcard(
            card_subgrid, "Esfuerzo real", "—", "MPa", 1
        )
        self.res_uso = self.crear_subcard(
            card_subgrid, "Capacidad usada", "—", "%", 2
        )
        self.res_flecha = self.crear_subcard(
            card_subgrid, "Deflexión máx", "—", "mm", 3
        )

        lbl_tbl = tk.Label(
            right_panel,
            text="LISTA DE PERFILES QUE CUMPLEN (ORDENADOS POR MENOR COSTO / MASA)",
            font=("Segoe UI", 9, "bold"),
            bg=self.COLOR_BG,
            fg=self.COLOR_MUTED,
        )
        lbl_tbl.pack(anchor="w", pady=(0, 6))

        tbl_frame = ttk.Frame(right_panel)
        tbl_frame.pack(fill="both", expand=True)

        columnas = (
            "perfil",
            "tipo",
            "masa",
            "sx",
            "spp",
            "sigma",
            "tau",
            "flecha",
            "uso",
        )
        self.tree = ttk.Treeview(
            tbl_frame, columns=columnas, show="headings", selectmode="browse"
        )

        headers = [
            ("perfil", "Perfil", 110),
            ("tipo", "Tipo", 60),
            ("masa", "Masa (kg/m)", 95),
            ("sx", "Sx (10³ mm³)", 95),
            ("spp", "S_pp req", 80),
            ("sigma", "σ real (MPa)", 95),
            ("tau", "τ real (MPa)", 95),
            ("flecha", "Flecha (mm)", 90),
            ("uso", "Uso σ (%)", 85),
        ]

        for col, txt, w in headers:
            self.tree.heading(col, text=txt)
            self.tree.column(col, width=w, anchor="center")

        scrollbar = ttk.Scrollbar(
            tbl_frame, orient="vertical", command=self.tree.yview
        )
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def crear_subcard(self, parent, titulo, valor, unidad, col):
        f = ttk.Frame(parent, style="Card.TFrame")
        f.grid(row=0, column=col, sticky="ew", padx=(0, 20))
        parent.columnconfigure(col, weight=1)

        t = ttk.Label(f, text=titulo, style="CardTitle.TLabel")
        t.pack(anchor="w")

        v = ttk.Label(f, text=valor, style="CardVal.TLabel")
        v.pack(anchor="w")

        u = ttk.Label(f, text=unidad, style="CardSub.TLabel")
        u.pack(anchor="w")
        return v

    def calcular(self):
        try:
            M_ext = float(self.entradas["M_ext"].get())
            V_ext = float(self.entradas["V_ext"].get())
            L = float(self.entradas["L_m"].get())
            sigma_adm = float(self.entradas["sigma_adm"].get())

            raw_flecha = self.entradas["flecha"].get()
            match_flecha = re.search(r"(\d+)", raw_flecha)
            if not match_flecha:
                raise ValueError("Límite de flecha no válido.")
            limite_flecha = float(match_flecha.group(1))

        except ValueError:
            messagebox.showerror(
                "Error de formato",
                "Por favor verifica que los valores numéricos ingresados sean correctos.",
                parent=self.root,
            )
            return

        tipo_sel = self.entradas["tipo"].get()
        tipo_filtro = tipo_sel.split()[0] if " " in tipo_sel else tipo_sel

        if tipo_filtro in ["W", "S", "C"]:
            pool = [p for p in self.catalogo if p["tipo"] == tipo_filtro]
        else:
            pool = self.catalogo

        tau_adm = 0.60 * sigma_adm
        flecha_adm = (L * 1000.0) / limite_flecha
        g = 9.81
        S_req_ext = (M_ext * 1e6) / (sigma_adm * 1000.0)

        candidatos = []

        for p in pool:
            w_pp = (p["masa"] * g) / 1000.0
            M_pp = (w_pp * (L**2)) / 8.0
            V_pp = (w_pp * L) / 2.0

            M_total = M_ext + M_pp
            V_total = V_ext + V_pp

            S_pp = (M_pp * 1e6) / (sigma_adm * 1000.0)
            sigma_real = (M_total * 1e6) / (p["Sx"] * 1000.0)

            area_alma = p["d"] * p["tw"]
            tau_real = (
                (V_total * 1000.0) / area_alma if area_alma > 0 else 999.0
            )

            I_mm4 = p["Ix"] * 1e6
            delta_pp = (5.0 * w_pp * ((L * 1000.0) ** 4)) / (
                384.0 * E_ACERO * I_mm4
            )
            delta_ext = (M_ext * 1e6 * ((L * 1000.0) ** 2)) / (
                10.0 * E_ACERO * I_mm4
            )
            delta_total = delta_pp + delta_ext

            if (
                sigma_real <= sigma_adm
                and tau_real <= tau_adm
                and delta_total <= flecha_adm
            ):
                candidatos.append(
                    {
                        "designacion": p["designacion"],
                        "tipo": p["tipo"],
                        "masa": p["masa"],
                        "Sx": p["Sx"],
                        "S_pp": S_pp,
                        "sigma": sigma_real,
                        "tau": tau_real,
                        "flecha": delta_total,
                        "uso": (sigma_real / sigma_adm) * 100.0,
                    }
                )

        for row in self.tree.get_children():
            self.tree.delete(row)

        if not candidatos:
            self.lbl_banner_perfil.config(
                text="Ningún perfil cumple las condiciones", fg="#ef4444"
            )
            self.res_masa.config(text="—")
            self.res_sigma.config(text="—")
            self.res_uso.config(text="—")
            self.res_flecha.config(text="—")
            messagebox.showwarning(
                "Sin resultados",
                "Ningún perfil satisfizo los esfuerzos y flecha máxima.",
                parent=self.root,
            )
            return

        candidatos.sort(key=lambda x: x["masa"])

        optimo = candidatos[0]
        self.lbl_banner_perfil.config(
            text=f"{optimo['designacion']}", fg="#ffffff"
        )
        self.res_masa.config(text=f"{optimo['masa']:.1f}")
        self.res_sigma.config(text=f"{optimo['sigma']:.1f}")
        self.res_uso.config(text=f"{optimo['uso']:.1f}%")
        self.res_flecha.config(text=f"{optimo['flecha']:.2f}")

        for c in candidatos:
            self.tree.insert(
                "",
                "end",
                values=(
                    c["designacion"],
                    c["tipo"],
                    f"{c['masa']:.1f}",
                    f"{c['Sx']:.0f}",
                    f"{c['S_pp']:.2f}",
                    f"{c['sigma']:.1f}",
                    f"{c['tau']:.1f}",
                    f"{c['flecha']:.2f}",
                    f"{c['uso']:.1f}%",
                ),
            )

        self.lbl_status.config(
            text=f"Catálogo: {len(self.catalogo)} perfiles ({self.ruta_csv_actual}) | {len(candidatos)} viables."
        )


if __name__ == "__main__":
    # Registrar identificador exclusivo de la app en Windows antes de abrir la ventana
    try:
        mi_app_id = "optisteel.structural.app.v1"
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(mi_app_id)
    except Exception:
        pass

    ventana = tk.Tk()
    app = OptiSteelApp(ventana)
    ventana.mainloop()