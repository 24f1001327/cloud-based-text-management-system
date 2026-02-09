import os
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)

    def __repr__(self):
        return f"<User(user_id={self.user_id}, username='{self.username}')>"


class Department(Base):
    __tablename__ = "departments"

    dept_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)

    subjects = relationship("Subject", back_populates="department", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Department(dept_id={self.dept_id}, name='{self.name}')>"


class Subject(Base):
    __tablename__ = "subjects"

    subject_id = Column(Integer, primary_key=True, autoincrement=True)
    dept_id = Column(Integer, ForeignKey("departments.dept_id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)

    department = relationship("Department", back_populates="subjects")
    chapters = relationship("Chapter", back_populates="subject", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Subject(subject_id={self.subject_id}, title='{self.title}')>"


class Chapter(Base):
    __tablename__ = "chapters"

    chapter_id = Column(Integer, primary_key=True, autoincrement=True)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)

    subject = relationship("Subject", back_populates="chapters")
    topics = relationship("Topic", back_populates="chapter", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Chapter(chapter_id={self.chapter_id}, title='{self.title}')>"


class Topic(Base):
    __tablename__ = "topics"

    topic_id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, ForeignKey("chapters.chapter_id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)

    chapter = relationship("Chapter", back_populates="topics")

    def __repr__(self):
        return f"<Topic(topic_id={self.topic_id}, title='{self.title}')>"


DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO") == "1"
)
SessionLocal = sessionmaker(bind=engine)

if __name__ == "__main__" and DATABASE_URL:
    Base.metadata.create_all(engine)

