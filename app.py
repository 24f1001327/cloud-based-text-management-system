from flask import Flask, render_template, request, redirect, url_for, session, flash
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from werkzeug.security import check_password_hash
from sqlalchemy.orm import Session, selectinload 
from model import engine, Department, Topic, Chapter, Subject  
from functools import wraps

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key")


def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        cursor_factory=RealDictCursor
    )


def login_required(view_func):
    @wraps(view_func)
    def wrapped_view(*args, **kwargs):
        if "user_id" not in session:
            next_url = request.full_path if request.full_path and request.full_path != '/' else request.path
            flash("Please log in to continue.", "warning")
            return redirect(url_for("login", next=next_url))
        return view_func(*args, **kwargs)
    return wrapped_view

@app.route("/", methods=["GET"])
def home():
    return render_template("login.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        with get_db() as conn, conn.cursor() as cur:
            cur.execute("SELECT id, username, password_hash FROM users WHERE username=%s", (username,))
            user = cur.fetchone()

        if user and check_password_hash(user["password_hash"], password):
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            flash("Login successful!", "success")

            next_url = request.args.get("next")
            if next_url:
                if next_url.startswith("/"):
                    return redirect(next_url)
            return redirect(url_for("dashboard"))
        else:
            flash("Invalid username or password.", "danger")

    return render_template("login_page.html")


@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("main.html")


@app.route("/education")
@login_required
def education_home():
    edit_mode = request.args.get("edit") == "1"
    with Session(bind=engine) as s:
        depts = (
            s.query(Department)
             .options(
                 selectinload(Department.subjects)
                     .options(
                         selectinload(Subject.chapters)
                             .options(
                                 selectinload(Chapter.topics)
                             )
                     )
             )
             .order_by(Department.name)
             .all()
        )
    return render_template("education_home.html", depts=depts, edit_mode=edit_mode)


@app.post("/education/department")
@login_required
def dept_create():
    name = request.form.get("name", "").strip()
    if not name:
        flash("Department name required.", "danger")
        return redirect(url_for("education_home"))
    with Session(bind=engine) as s:
        if s.query(Department).filter_by(name=name).first():
            flash("Department already exists.", "danger")
        else:
            s.add(Department(name=name))
            s.commit()
            flash("Department created.", "success")
    return redirect(url_for("education_home"))

@app.post("/education/department/<int:dept_id>/update")
@login_required
def dept_update(dept_id):
    name = request.form.get("name", "").strip()
    with Session(bind=engine) as s:
        d = s.get(Department, dept_id)
        if not d:
            flash("Department not found.", "danger")
        else:
            if name:
                d.name = name
            s.commit()
            flash("Department updated.", "success")
    return redirect(url_for("education_home"))

@app.post("/education/department/<int:dept_id>/delete")
@login_required
def dept_delete(dept_id):
    with Session(bind=engine) as s:
        d = s.get(Department, dept_id)
        if not d:
            flash("Department not found.", "danger")
        else:
            s.delete(d)
            s.commit()
            flash("Department deleted.", "info")
    return redirect(url_for("education_home"))


@app.post("/education/subject")
@login_required
def subject_create():
    dept_id = request.form.get("dept_id", type=int)
    title = request.form.get("title", "").strip()
    if not (dept_id and title):
        flash("Subject title and department required.", "danger")
        return redirect(url_for("education_home"))
    with Session(bind=engine) as s:
        if not s.get(Department, dept_id):
            flash("Department not found.", "danger")
        else:
            s.add(Subject(dept_id=dept_id, title=title))
            s.commit()
            flash("Subject created.", "success")
    return redirect(url_for("education_home"))

@app.post("/education/subject/<int:subject_id>/update")
@login_required
def subject_update(subject_id):
    title = request.form.get("title", "").strip()
    with Session(bind=engine) as s:
        subj = s.get(Subject, subject_id)
        if not subj:
            flash("Subject not found.", "danger")
        else:
            if title:
                subj.title = title
            s.commit()
            flash("Subject updated.", "success")
    return redirect(url_for("education_home"))

@app.post("/education/subject/<int:subject_id>/delete")
@login_required
def subject_delete(subject_id):
    with Session(bind=engine) as s:
        subj = s.get(Subject, subject_id)
        if not subj:
            flash("Subject not found.", "danger")
        else:
            s.delete(subj)
            s.commit()
            flash("Subject deleted.", "info")
    return redirect(url_for("education_home"))


@app.post("/education/chapter")
@login_required
def chapter_create():
    subject_id = request.form.get("subject_id", type=int)
    title = request.form.get("title", "").strip()
    if not (subject_id and title):
        flash("Chapter title and subject required.", "danger")
        return redirect(url_for("education_home"))
    with Session(bind=engine) as s:
        if not s.get(Subject, subject_id):
            flash("Subject not found.", "danger")
        else:
            s.add(Chapter(subject_id=subject_id, title=title))
            s.commit()
            flash("Chapter created.", "success")
    return redirect(url_for("education_home"))

@app.post("/education/chapter/<int:chapter_id>/update")
@login_required
def chapter_update(chapter_id):
    title = request.form.get("title", "").strip()
    with Session(bind=engine) as s:
        chap = s.get(Chapter, chapter_id)
        if not chap:
            flash("Chapter not found.", "danger")
        else:
            if title:
                chap.title = title
            s.commit()
            flash("Chapter updated.", "success")
    return redirect(url_for("education_home"))

@app.post("/education/chapter/<int:chapter_id>/delete")
@login_required
def chapter_delete(chapter_id):
    with Session(bind=engine) as s:
        chap = s.get(Chapter, chapter_id)
        if not chap:
            flash("Chapter not found.", "danger")
        else:
            s.delete(chap)
            s.commit()
            flash("Chapter deleted.", "info")
    return redirect(url_for("education_home"))


@app.post("/education/topic")
@login_required
def topic_create():
    chapter_id = request.form.get("chapter_id", type=int)
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    if not (chapter_id and title):
        flash("Topic title and chapter required.", "danger")
        return redirect(url_for("education_home"))
    with Session(bind=engine) as s:
        if not s.get(Chapter, chapter_id):
            flash("Chapter not found.", "danger")
        else:
            s.add(Topic(chapter_id=chapter_id, title=title, description=description))
            s.commit()
            flash("Topic created.", "success")
    return redirect(url_for("education_home"))

@app.post("/education/topic/<int:topic_id>/update")
@login_required
def topic_update(topic_id):
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    with Session(bind=engine) as s:
        t = s.get(Topic, topic_id)
        if not t:
            flash("Topic not found.", "danger")
        else:
            if title:
                t.title = title
            t.description = description
            s.commit()
            flash("Topic updated.", "success")
    return redirect(url_for("education_home"))

@app.post("/education/topic/<int:topic_id>/delete")
@login_required
def topic_delete(topic_id):
    with Session(bind=engine) as s:
        t = s.get(Topic, topic_id)
        if not t:
            flash("Topic not found.", "danger")
        else:
            s.delete(t)
            s.commit()
            flash("Topic deleted.", "info")
    return redirect(url_for("education_home"))


@app.route("/logout")
@login_required
def logout():
    session.clear()
    flash("Logged out.", "info")
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run()
