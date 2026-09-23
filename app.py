
import os, sqlite3, io, json, csv, hashlib, secrets, shutil, uuid
from datetime import datetime
from functools import wraps
from pathlib import Path
from flask import Flask, render_template, request, redirect, url_for, session, flash, send_file, jsonify, abort
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from PIL import Image
from openpyxl import load_workbook
from openpyxl.chart import LineChart, BarChart, Reference
from openpyxl.chart.label import DataLabelList

BASE=Path(__file__).resolve().parent
INSTANCE=BASE/"instance"
INSTANCE.mkdir(exist_ok=True)
DB_PATH=Path(os.getenv("DATABASE_PATH", str(INSTANCE/"scgpc_lab.db")))
TEMPLATE_XLSX=BASE/"static"/"SCGPC_Fire_Resistance_SCBA_Charts_template.xlsx"
EXPORT_DIR=BASE/"exports"; EXPORT_DIR.mkdir(exist_ok=True)
UPLOAD_DIR=BASE/"static"/"uploads"; UPLOAD_DIR.mkdir(exist_ok=True)

app=Flask(__name__)
app.secret_key=os.getenv("SECRET_KEY", secrets.token_hex(32))
app.config["MAX_CONTENT_LENGTH"]=12*1024*1024

MIXES=[
("M0",0,"4M"),("M1",5,"4M"),("M2",10,"4M"),("M3",15,"4M"),("M4",20,"4M"),("M5",25,"4M"),
("M6",0,"6M"),("M7",5,"6M"),("M8",10,"6M"),("M9",15,"6M"),("M10",20,"6M"),("M11",25,"6M")
]
TEMPS=[200,400,600,800]
REPS=[1,2,3]

TEAM=[
    {"id":"24B95A0128","name":"RAMAKURI AJAY BABU","role":"Project Lead"},
    {"id":"24B95A0119","name":"KANTETI KODANDA NAGA SURESH","role":"Team Member"},
    {"id":"24B95A0112","name":"GOLLAVILLI JAYA LAKSHMI DURGA ABHISHEK","role":"Super Admin / Team Member"},
    {"id":"24B95A0121","name":"KONAGALLA NANI","role":"Team Member"},
]

PROJECT={
"title":"Effect of Sugarcane Bagasse Ash (SCBA) on Fire Resistance of Fly Ash–GGBS Based SCGPC",
"subtitle":"Self-Compacting Geopolymer Concrete | Experiment • Analyse • Innovate",
"supervisor":"Dr. M. Venkata Rao, Assistant Professor",
"department":"Department of Civil Engineering",
"college":"Sagi Rama Krishnam Raju Engineering College (A), Bhimavaram",
"aim":"To investigate the fire resistance and residual compressive strength of SCBA-modified Fly Ash–GGBS based Self-Compacting Geopolymer Concrete (SCGPC) with different SCBA replacement levels and NaOH molarities under elevated-temperature exposure.",
"gap":"The reviewed work identifies a need for more comprehensive study of the combined influence of SCBA content, NaOH molarity and elevated temperature in ternary SCBA–Fly Ash–GGBS SCGPC, especially for post-fire performance.",
"parameters":"Fly Ash:GGBS = 70:30 • SCBA = 0–25% • NaOH = 4M & 6M • Temperatures = 200°C, 400°C, 600°C, 800°C • Hold = 2 h • Natural air cooling • 12 mixes • 144 cubes • 3 replicates per condition • 100 mm cube • CTM loading rate = 2.5 kN/s",
}

REFERENCES=[
"Vo, T.-V., Phan, V. T.-A., & Le, D.-H. (2025). Sustainable use of sugarcane bagasse ash in fly ash-based geopolymers: Implications for compressive strength and shrinkage. Periodica Polytechnica Civil Engineering, 69(3), 869–883.",
"Rihan, M. A. M., Onchiri, R. O., Gathimba, N., & Sabuni, B. (2024). Mechanical and microstructural properties of geopolymer concrete containing fly ash and sugarcane bagasse ash. Civil Engineering Journal.",
"Thoudam, N., Lairikyengbam, T., & Thokchom, S. (2022). Effect of sugarcane bagasse ash in GGBS geopolymer composites. ASPS Conference Proceedings, 1(1), 143–146.",
"Rangan, B. V. (2010). Fly ash-based geopolymer concrete. International Workshop on Geopolymer Cement and Concrete.",
"Pandey, D., Pandey, R. K., & Mishra, R. K. (2024). Analysis of fly ash and GGBS-based geopolymer concrete under different curing conditions. Journal of Environmental Nanotechnology, 13(4), 72–79.",
"Hombali, A., & Selvam, J. (2025). Performance evaluation of low-carbon geopolymer concrete incorporating industrial and agricultural wastes. Matéria, 30, e20250723.",
"Vigneshkumar, A., Christy, C. F., Muthukannan, M., & Alengaram, U. J. (2024). Fresh, hardened properties and microstructural analysis on the effect of NaOH molarities of industrial by-products based self-compacting geopolymer concrete. International Review of Applied Sciences and Engineering, 16(3).",
"Tanu, H. M., & Unnikrishnan, S. (2024). Performance evaluation and sustainability analysis of geopolymer concrete developed with ground granulated blast furnace slag and sugarcane bagasse ash. Journal of Building Pathology and Rehabilitation, 9(2).",
"Rihan, M. A. M., Alahmari, T. S., Onchiri, R. O., Gathimba, N., & Sabuni, B. (2024). Impact of alkaline concentration on the mechanical properties of geopolymer concrete made up of fly ash and sugarcane bagasse ash. Sustainability, 16(7), 2841.",
"Tanu, H. M., & Unnikrishnan, S. (2023). Mechanical strength and microstructure of GGBS-SCBA based geopolymer concrete. Journal of Materials Research and Technology, 24, 7816–7831.",
"Abd Razak, S. N., Shafiq, N., Guillaumat, L., Farhan, S. A., & Lohana, V. K. (2022). Fire-exposed fly ash-based geopolymer concrete: Effects of burning temperature on mechanical and microstructural properties. Materials, 15(5), 1884.",
"Srinivas, D., & Suresh, N. (2024). Mechanical properties of geopolymer concrete subjected to elevated temperature. International Journal for Research in Applied Science & Engineering Technology.",
"Tanu, H. M., & Unnikrishnan, S. (2023). Durability and elevated temperature behaviour of geopolymer concrete developed with ground granulated blast furnace slag and sugarcane bagasse ash. Journal of Building Pathology and Rehabilitation, 8(2).",
"Chuewangkam, N., Nachaithong, T., Chanlek, N., Thongbai, P., & Pinitsoontorn, S. (2022). Mechanical and dielectric properties of fly ash geopolymer-sugarcane bagasse ash composites. Polymers, 14(6), 1140.",
"Rihan, M. A. M., Onchiri, R. O., Gathimba, G., & Sabuni, B. (2024). Effect of sugarcane bagasse ash addition and curing temperature on the mechanical properties and microstructure of fly ash based geopolymer concrete. Open Ceramics, 19, 100616."
]

def db():
    c=sqlite3.connect(DB_PATH)
    c.row_factory=sqlite3.Row
    return c

def init_db():
    c=db()

    c.executescript("""
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('superadmin','editor','user')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mix_id TEXT NOT NULL,
      temperature INTEGER NOT NULL,
      replicate INTEGER NOT NULL,
      test_date TEXT NOT NULL,
      pre_mass REAL,
      pre_notes TEXT,
      post_mass REAL,
      colour TEXT,
      cracking TEXT,
      spalling TEXT,
      fire_notes TEXT,
      heating_rate TEXT,
      exposure_hours REAL,
      actual_hold_hours REAL,
      furnace_used TEXT,
      failure_load REAL,
      original_strength REAL,
      ctm_rate REAL,
      remarks TEXT,
      photo_before TEXT,
      photo_after TEXT,
      submitted_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(mix_id,temperature,replicate)
    );

    CREATE TABLE IF NOT EXISTS notes(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_date TEXT NOT NULL,
      category TEXT NOT NULL,
      mix_id TEXT,
      temperature INTEGER,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      activity TEXT,
      created_at TEXT NOT NULL
    );
    """)

    existing_cols={r[1] for r in c.execute("PRAGMA table_info(entries)").fetchall()}

    migrations={
        "fire_notes":"TEXT",
        "heating_rate":"TEXT",
        "exposure_hours":"REAL",
        "actual_hold_hours":"REAL",
        "furnace_used":"TEXT",
        "photo_before":"TEXT",
        "photo_after":"TEXT"
    }

    for col,typ in migrations.items():
        if col not in existing_cols:
            c.execute(f"ALTER TABLE entries ADD COLUMN {col} {typ}")

    c.commit()
    c.close()


init_db()


DEMO_USERS = {
    "abhishek_admin": {
        "password": "SCGPC@Admin2026",
        "display_name": "Abhishek",
        "role": "superadmin"
    },
    "project_supervisor": {
        "password": "SCGPC@Supervisor2026",
        "display_name": "Dr. M. Venkata Rao",
        "role": "superadmin"
    },
    "ajay_babu": {
        "password": "SCGPC@Ajay2026",
        "display_name": "RAMAKURI AJAY BABU",
        "role": "editor"
    },
    "common_user": {
        "password": "SCGPC@Common2026",
        "display_name": "Common User",
        "role": "user"
    }
}


def current_user():
    username = session.get("username")
    if not username:
        return None

    user = DEMO_USERS.get(username)
    if not user:
        return None

    return {
        "username": username,
        "display_name": user["display_name"],
        "role": user["role"],
        "active": 1
    }

def login_required(f):
    @wraps(f)
    def wrap(*a,**kw):
        if not current_user():
            return redirect(url_for("login"))
        return f(*a,**kw)
    return wrap

def role_required(*roles):
    def deco(f):
        @wraps(f)
        def wrap(*a,**kw):
            u=current_user()
            if not u: return redirect(url_for("login"))
            if u["role"] not in roles: abort(403)
            return f(*a,**kw)
        return wrap
    return deco

def log(activity):
    u=current_user()
    c=db(); c.execute("INSERT INTO activities(username,activity,created_at) VALUES(?,?,?)",(u["username"] if u else "system",activity,datetime.now().isoformat())); c.commit(); c.close()

def entry_metrics(row):
    d=dict(row) if hasattr(row,"keys") else row
    pre=d.get("pre_mass"); post=d.get("post_mass"); load=d.get("failure_load"); orig=d.get("original_strength")
    mass_loss=((pre-post)/pre*100) if pre not in (None,0) and post is not None else None
    strength=(load*1000/10000) if load is not None else None
    residual=(strength/orig*100) if strength is not None and orig not in (None,0) else None
    return mass_loss,strength,residual

def all_entries():
    c=db(); rows=c.execute("SELECT * FROM entries ORDER BY temperature, CAST(SUBSTR(mix_id,2) AS INTEGER), replicate").fetchall(); c.close()
    return [dict(r) for r in rows]

def completion():
    rows=all_entries()
    filled=sum(1 for r in rows if r["pre_mass"] is not None or r["post_mass"] is not None or r["failure_load"] is not None)
    return filled,144,round(filled/144*100,1)

@app.context_processor
def inject():
    u=current_user()
    return {"me":u,"project":PROJECT,"mixes":MIXES,"temps":TEMPS}

@app.route("/")
def home():
    return redirect(url_for("dashboard") if current_user() else url_for("login"))

@app.route("/login",methods=["GET","POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username","").strip()
        password = request.form.get("password","")

        user = DEMO_USERS.get(username)

        if user and user["password"] == password:
            session.clear()
            session["username"] = username
            log("Logged in")
            return redirect(url_for("dashboard"))

        flash("Incorrect username or password.","error")

    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    return render_template("logout.html")
@app.route("/do-logout")
@login_required
def do_logout():
    log("Logged out"); session.clear(); return redirect(url_for("login"))

@app.route("/dashboard")
@login_required
def dashboard():
    filled,total,pct=completion()
    c=db()
    recent=[dict(x) for x in c.execute("SELECT * FROM entries ORDER BY updated_at DESC LIMIT 6").fetchall()]
    notes=[dict(x) for x in c.execute("SELECT * FROM notes ORDER BY updated_at DESC LIMIT 3").fetchall()]
    c.close()
    bytemp={}
    for t in TEMPS:
        n=sum(1 for r in all_entries() if r["temperature"]==t and any(r[k] is not None for k in ("pre_mass","post_mass","failure_load")))
        bytemp[t]=n
    matrix={}
    for m,scba,mol in MIXES:
        matrix[m]=[sum(1 for r in all_entries() if r["mix_id"]==m and r["temperature"]==t and any(r[k] is not None for k in ("pre_mass","post_mass","failure_load"))) for t in TEMPS]
    return render_template("dashboard.html",filled=filled,total=total,pct=pct,recent=recent,notes=notes,bytemp=bytemp,matrix=matrix)

@app.route("/project")
@login_required
def project_details():
    return render_template("project.html",team=TEAM,refs=REFERENCES)

ALLOWED_IMAGE_EXT={"jpg","jpeg","png","webp"}

def save_uploaded_image(file_obj, specimen_id, kind):
    if not file_obj or not file_obj.filename:
        return None
    original=secure_filename(file_obj.filename)
    ext=original.rsplit(".",1)[-1].lower() if "." in original else ""
    if ext not in ALLOWED_IMAGE_EXT:
        raise ValueError("Only JPG, JPEG, PNG or WEBP images are allowed.")
    try:
        file_obj.stream.seek(0)
        with Image.open(file_obj.stream) as img:
            img.verify()
        file_obj.stream.seek(0)
    except Exception:
        raise ValueError("The uploaded file is not a valid image.")
    filename=f"{secure_filename(specimen_id)}-{kind}-{uuid.uuid4().hex[:10]}.{ext}"
    file_obj.save(UPLOAD_DIR/filename)
    return filename

@app.route("/data-entry",methods=["GET","POST"])
@login_required
def data_entry():
    if request.method=="POST":
        u=current_user()
        mix=request.form.get("mix_id"); temp=int(request.form.get("temperature")); rep=int(request.form.get("replicate"))
        if (mix,temp,rep) not in [(m,t,r) for m,_,_ in MIXES for t in TEMPS for r in REPS]:
            flash("Invalid specimen selection.","error"); return redirect(url_for("data_entry"))
        c=db()
        old=c.execute("SELECT * FROM entries WHERE mix_id=? AND temperature=? AND replicate=?",(mix,temp,rep)).fetchone()
        if old and u["role"]=="user":
            c.close(); flash("This specimen is already submitted and locked for common users.","error"); return redirect(url_for("data_entry",mix=mix,temp=temp,rep=rep))
        now=datetime.now().isoformat(); specimen_id=f"{mix}-{temp}-{rep}"
        try:
            before=save_uploaded_image(request.files.get("photo_before"),specimen_id,"Before")
            after=save_uploaded_image(request.files.get("photo_after"),specimen_id,"After")
        except ValueError as e:
            c.close(); flash(str(e),"error"); return redirect(url_for("data_entry",mix=mix,temp=temp,rep=rep))
        if old:
            before=before or old["photo_before"]
            after=after or old["photo_after"]
        values={
          "test_date":request.form.get("test_date") or datetime.now().date().isoformat(),
          "pre_mass":request.form.get("pre_mass") or None, "pre_notes":request.form.get("pre_notes","").strip(),
          "post_mass":request.form.get("post_mass") or None, "colour":request.form.get("colour","").strip(),
          "cracking":request.form.get("cracking","").strip(), "spalling":request.form.get("spalling","").strip(),
          "fire_notes":request.form.get("fire_notes","").strip(), "heating_rate":request.form.get("heating_rate","5–10").strip(),
          "exposure_hours":request.form.get("exposure_hours") or 2, "actual_hold_hours":request.form.get("actual_hold_hours") or 2,
          "furnace_used":request.form.get("furnace_used","Electrical Kiln").strip(),
          "failure_load":request.form.get("failure_load") or None, "original_strength":request.form.get("original_strength") or None,
          "ctm_rate":request.form.get("ctm_rate") or 2.5, "remarks":request.form.get("remarks","").strip(),
          "photo_before":before, "photo_after":after, "submitted_by":u["username"], "updated_at":now,
        }
        fields=["test_date","pre_mass","pre_notes","post_mass","colour","cracking","spalling","fire_notes","heating_rate","exposure_hours","actual_hold_hours","furnace_used","failure_load","original_strength","ctm_rate","remarks","photo_before","photo_after","submitted_by","updated_at"]
        if old and u["role"] in ("editor","superadmin"):
            c.execute("""UPDATE entries SET test_date=?,pre_mass=?,pre_notes=?,post_mass=?,colour=?,cracking=?,spalling=?,fire_notes=?,heating_rate=?,exposure_hours=?,actual_hold_hours=?,furnace_used=?,failure_load=?,original_strength=?,ctm_rate=?,remarks=?,photo_before=?,photo_after=?,submitted_by=?,updated_at=? WHERE mix_id=? AND temperature=? AND replicate=?""", tuple(values[k] for k in fields)+(mix,temp,rep))
            action="Edited data"
        else:
            c.execute("""INSERT INTO entries(mix_id,temperature,replicate,test_date,pre_mass,pre_notes,post_mass,colour,cracking,spalling,fire_notes,heating_rate,exposure_hours,actual_hold_hours,furnace_used,failure_load,original_strength,ctm_rate,remarks,photo_before,photo_after,submitted_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (mix,temp,rep,*(values[k] for k in fields[:-1]),now,now))
            action="Submitted data"
        c.commit(); c.close(); log(f"{action}: {mix} at {temp}°C Rep {rep}")
        flash("Data saved successfully.","ok")
        return redirect(url_for("data_entry",mix=mix,temp=temp,rep=rep))
    mix=request.args.get("mix",MIXES[0][0]); temp=int(request.args.get("temp",200)); rep=int(request.args.get("rep",1))
    c=db(); row=c.execute("SELECT * FROM entries WHERE mix_id=? AND temperature=? AND replicate=?",(mix,temp,rep)).fetchone(); c.close()
    existing=dict(row) if row else None; metrics=entry_metrics(existing) if existing else (None,None,None)
    return render_template("data_entry.html",mix=mix,temp=temp,rep=rep,existing=existing,metrics=metrics)

@app.route("/graphs")
@login_required
def graphs():
    return render_template("graphs.html")

@app.route("/api/graph")
@login_required
def graph_api():
    x=request.args.get("x","temperature"); y=request.args.get("y","residual"); group=request.args.get("group","mix")
    c=db(); rows=[dict(r) for r in c.execute("SELECT * FROM entries").fetchall()]; c.close()
    agg={}
    mixmeta={m:(scba,mol) for m,scba,mol in MIXES}
    for r in rows:
        ml,st,res=entry_metrics(r)
        key=(r["mix_id"],r["temperature"])
        agg.setdefault(key,{"mass":[],"strength":[],"residual":[]})
        if ml is not None: agg[key]["mass"].append(ml)
        if st is not None: agg[key]["strength"].append(st)
        if res is not None: agg[key]["residual"].append(res)
    series={}
    for (mix,t),v in agg.items():
        for k in v: v[k]=sum(v[k])/len(v[k]) if v[k] else None
        val=v["mass"] if y=="mass" else (v["strength"] if y=="strength" else v["residual"])
        if val is None: continue
        scba,_=mixmeta[mix]
        xv=t if x=="temperature" else scba
        key=mix if group=="mix" else str(t)+"°C"
        series.setdefault(key,[]).append({"x":xv,"y":round(val,3)})
    for arr in series.values(): arr.sort(key=lambda z:z["x"])
    return jsonify({"series":series,"x":x,"y":y,"group":group})
@app.route("/results")
@login_required
def results():
    c=db(); rows=[dict(r) for r in c.execute("SELECT * FROM entries").fetchall()]; c.close()
    summary=[]; strengths=[]; residuals=[]; mass_losses=[]
    for mix,scba,mol in MIXES:
        tempsum={}
        for t in TEMPS:
            vals=[]
            for r in rows:
                if r["mix_id"]==mix and r["temperature"]==t:
                    ml,st,res=entry_metrics(r)
                    if res is not None: vals.append(res)
                    if st is not None: strengths.append((st,mix,t))
                    if res is not None: residuals.append((res,mix,t))
                    if ml is not None: mass_losses.append((ml,mix,t))
            tempsum[t]=round(sum(vals)/len(vals),2) if vals else None
        summary.append({"mix":mix,"scba":scba,"mol":mol,**{f"t{t}":tempsum[t] for t in TEMPS}})
    max_strength=max(strengths,key=lambda x:x[0]) if strengths else None
    max_residual=max(residuals,key=lambda x:x[0]) if residuals else None
    max_mass=max(mass_losses,key=lambda x:x[0]) if mass_losses else None
    metrics={
      "max_strength":max_strength[0] if max_strength else None,
      "max_strength_mix":max_strength[1] if max_strength else None,
      "max_strength_temp":max_strength[2] if max_strength else None,
      "max_residual":max_residual[0] if max_residual else None,
      "max_residual_mix":max_residual[1] if max_residual else None,
      "max_residual_temp":max_residual[2] if max_residual else None,
      "max_mass":max_mass[0] if max_mass else None,
      "max_mass_mix":max_mass[1] if max_mass else None,
      "max_mass_temp":max_mass[2] if max_mass else None,
    }
    return render_template("results.html",summary=summary,metrics=metrics)

@app.route("/notes",methods=["GET","POST"])
@login_required
def notes():
    if request.method=="POST":
        u=current_user()
        c=db(); c.execute("""INSERT INTO notes(note_date,category,mix_id,temperature,title,body,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)""",
          (request.form.get("note_date") or datetime.now().date().isoformat(),request.form.get("category","General"),
           request.form.get("mix_id") or None,request.form.get("temperature") or None,request.form.get("title","Untitled"),
           request.form.get("body",""),u["username"],datetime.now().isoformat(),datetime.now().isoformat()))
        c.commit(); c.close(); log("Added note"); flash("Note added.","ok")
        return redirect(url_for("notes"))
    c=db(); items=[dict(x) for x in c.execute("SELECT * FROM notes ORDER BY updated_at DESC").fetchall()]; c.close()
    return render_template("notes.html",items=items,now=datetime.now().date().isoformat())

@app.route("/export")
@login_required
def export_page():
    filled,total,pct=completion()
    return render_template("export.html",filled=filled,total=total,pct=pct)

@app.route("/export/excel")
@login_required
def export_excel():
    # Preserve uploaded workbook formatting/template; populate data sheets.
    wb=load_workbook(TEMPLATE_XLSX)
    wb.calculation.fullCalcOnLoad=True
    wb.calculation.forceFullCalc=True
    wb.calculation.calcMode="auto"
    ws=wb["2 - Raw Data Entry"]; visual=wb["6 - Visual Observations Log"]; mixws=wb["1 - Mix Reference"]
    c=db(); rows=[dict(r) for r in c.execute("SELECT * FROM entries ORDER BY temperature, CAST(SUBSTR(mix_id,2) AS INTEGER), replicate").fetchall()]; c.close()
    # map mix -> baseline row in template
    mix_row={mixws.cell(r,1).value:r for r in range(5,17)}
    for mix,scba,mol in MIXES:
        r=mix_row[mix]
        # leave formatting intact, only update baseline if entries supply one
        vals=[x["original_strength"] for x in rows if x["mix_id"]==mix and x["original_strength"] is not None]
        if vals: mixws.cell(r,9).value=vals[-1]
    # exact 144 rows are 5..148; order in workbook is mix grouped by temperature
    for r in range(5,149):
        mix=ws.cell(r,1).value; temp=ws.cell(r,2).value; rep=ws.cell(r,3).value
        row=next((x for x in rows if x["mix_id"]==mix and x["temperature"]==temp and x["replicate"]==rep),None)
        if not row: continue
        ws.cell(r,4).value=row["pre_mass"]; ws.cell(r,5).value=row["pre_notes"]
        ws.cell(r,6).value=row["post_mass"]; ws.cell(r,7).value=row["colour"]
        ws.cell(r,8).value=row["cracking"]; ws.cell(r,9).value=row["spalling"]; ws.cell(r,10).value=row["failure_load"]
        photos=[]
        if row.get("photo_before"): photos.append(f"Before: {row['photo_before']}")
        if row.get("photo_after"): photos.append(f"After: {row['photo_after']}")
        ws.cell(r,16).value=" | ".join(photos) or None
        vr=r
        visual.cell(vr,6).value=row["colour"]; visual.cell(vr,7).value=row["cracking"]; visual.cell(vr,8).value=row["spalling"]
        visual_notes=[]
        if row.get("fire_notes"): visual_notes.append(f"Fire: {row['fire_notes']}")
        if row.get("remarks"): visual_notes.append(f"Remarks: {row['remarks']}")
        visual.cell(vr,9).value=" | ".join(visual_notes) or None
    # Add small metadata to instructions footer without changing core layout
    out=EXPORT_DIR/f"SCGPC_Fire_Resistance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    wb.save(out)
    log("Exported Excel")
    return send_file(out,as_attachment=True,download_name=out.name)

@app.route("/admin")
@role_required("superadmin")
def admin():
    users = [
        {
            "username": username,
            "display_name": user["display_name"],
            "role": user["role"],
            "active": 1
        }
        for username, user in DEMO_USERS.items()
    ]

    c = db()
    acts = [
        dict(x)
        for x in c.execute(
            "SELECT * FROM activities ORDER BY id DESC LIMIT 8"
        ).fetchall()
    ]
    c.close()

    return render_template("admin.html", users=users, acts=acts)
@app.errorhandler(403)
def forbidden(e): return render_template("error.html",code=403,message="Access restricted. Only authorized roles can use this section."),403
@app.errorhandler(404)
def notfound(e): return render_template("error.html",code=404,message="Page not found."),404
@app.errorhandler(500)
def server_error(e): return render_template("error.html",code=500,message="Server error. Please check the application logs."),500

if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.getenv("PORT","5000")),debug=False)
