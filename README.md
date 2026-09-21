# SCGPC Fire Resistance Research Lab — New Website

Fresh Flask website for the SCGPC fire-resistance project, built from the supplied UI reference images and the supplied Excel workbook.

## Included pages
- Login
- Dashboard
- Project Details
- Data Entry
- Graphs & Analysis
- Results
- Notes
- Export Data
- Admin Panel
- Logout

## Roles
- **Super Admin**: `abhishek_admin`
- **Editor**: `projectlead`
- **Common User**: `common_user`

Default local-test passwords:
- Super Admin: `SCGPC@Admin2026`
- Editor: `SCGPC@Lead2026`
- Common User: `SCGPC@User2026`

For any public deployment, set `SUPERADMIN_PASSWORD`, `EDITOR_PASSWORD`, and `USER_PASSWORD` in the hosting environment before sharing the site.

## Experimental structure
- 12 mixes: M0–M11
- Fly Ash:GGBS = 70:30
- SCBA = 0%, 5%, 10%, 15%, 20%, 25%
- NaOH = 4M and 6M
- Temperatures = 200°C, 400°C, 600°C, 800°C
- 3 replicates per condition
- 144 specimen slots total

## Data Entry
The data-entry form stores:
- specimen/date information
- pre-fire mass and observations
- fire notes, heating rate, exposure/holding time and furnace used
- post-fire mass, colour, cracking and spalling
- CTM failure load, original 28-day strength and loading rate
- calculated compressive strength and residual strength
- before/after specimen photographs
- remarks

Common-user entries are locked after submission. Editors and Super Admins can edit existing entries.

## Excel export
`static/SCGPC_Fire_Resistance_SCBA_Charts_template.xlsx` is the supplied workbook used as the export master. The exporter keeps the workbook's existing sheets, layout, formulas and formatting and writes website data into the corresponding 144 specimen rows.

The export also records uploaded before/after photo filenames in the workbook and writes fire notes/remarks into the Visual Observations Log.

## Local run
```bash
pip install -r requirements.txt
python app.py
```

Production:
```bash
gunicorn --bind 0.0.0.0:$PORT app:app
```

## Environment
Set:
- `SECRET_KEY`
- `SUPERADMIN_PASSWORD`
- `EDITOR_PASSWORD`
- `USER_PASSWORD`
- `DATABASE_PATH` (optional; defaults to `instance/scgpc_lab.db`)

For hosted use, use persistent database/storage. A default SQLite database on an ephemeral hosting filesystem should not be treated as permanent research-data storage.

## Verification completed
- Python syntax check passed.
- Jinja template parsing passed for all templates.
- JavaScript syntax check passed.
- Render configuration YAML parsed successfully.
- Excel template SHA-256 was verified against the supplied workbook.
- Workbook contains exactly 144 unique specimen rows covering M0–M11 × 200/400/600/800°C × Replicates 1–3.
- Database insert/update parameter counts were tested with the final schema.
- Excel formulas in the raw-data template were verified to remain intact after export-style writes.
