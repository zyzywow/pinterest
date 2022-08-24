const express = require("express");
const app = express();
const dotenv = require("dotenv").config();
const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary");
const { defaultFormat } = require("moment");

const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const { copyFileSync } = require("fs");
const { serialize } = require("v8");

app.use(
  session({
    secret: "아무거나",
    resave: true, // 강제로 재 저장하겠느냐,..
    saveUninitialized: false, // 빈값을 저장하겠느냐..
    cookie: { maxAge: 1000 * 60 * 60 }, // milli second로 시간 설정
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: "userID",
      passwordField: "userPW",
      session: true,
      passReqToCallback: false,
    },
    (id, password, done) => {
      console.log(id, "===", password);
      db.collection("member").findOne({ userID: id }, (err, result) => {
        if (err) {
          return done(err);
        }
        if (!result) return done(null, false, { message: "존재하지 않는 아이디 입니다." });
        if (result) {
          if (password === result.userPW) {
            console.log("로그인 성공");
            return done(null, result);
          } else {
            console.log("로그인 실패");
            return done(null, false, { message: "password를 확인해주세요." });
          }
        }
      });
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user.userID);
});
passport.deserializeUser((id, done) => {
  db.collection("member").findOne({ userID: id }, (err, result) => {
    done(null, result);
  });
});

const MongoClient = require("mongodb").MongoClient;
let db = null;
MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true }, (err, client) => {
  if (err) {
    console.log(err);
  }
  db = client.db("crudapp");
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false })); // post에서 보낸데이터req.body로받으려면 있어야함.
app.use(express.static(path.join(__dirname, "/public"))); // 정적파일 경로에있는것 쓰겠다.
app.use("/upload", express.static(path.join(__dirname, "/upload"))); // 로컬저장용도

app.set("port", process.env.PORT || 8099);
const PORT = app.get("port");

const storage = multer.diskStorage({
  destination: (req, file, done) => {
    done(null, path.join(__dirname, "/upload"));
  },
  filename: (req, file, done) => {
    done(null, file.originalname);
  },
});
const fileUpload = multer({ storage: storage });

app.get("/", (req, res) => {
  // db에서 데이터 읽어서
  // index로 데이터 전달하기..
  db.collection("pinterest")
    .find()
    .toArray((err, result) => {
      res.render("index", { list: result });
    });
});
app.get("/list", (req, res) => {
  db.collection("pinterest")
    .find()
    .toArray((err, result) => {
      res.render("list", { list: result });
    });
});
app.get("/detail/:id", (req, res) => {
  // console.log(req.params.id);
  const id = parseInt(req.params.id);
  // get으로 넘어오는 모든값 string!!!!! mongo에""없어도 헷갈리지말기!!

  db.collection("pinterest").findOne({ id: id }, (err, result) => {
    if (result) {
      res.render("detail", { title: "detail", result: result });
    } else {
      console.log("aa");
    }
  });
  // res.render("detail");
});
app.get("/insert", (req, res) => {
  res.render("insert");
});
app.post("/register", fileUpload.single("image"), (req, res) => {
  const title = req.body.title;
  const date = req.body.date;
  const category = Array.isArray(req.body.category) ? req.body.category.join(" ") : req.body.category;
  const desc = req.body.desc;
  const point = req.body.point;
  const image = req.file.filename;
  console.log(title, "===", date, "===", category, "===", desc, "===", point, "===", image);

  // res.render("insert");
  cloudinary.uploader.upload(req.file.path, (result) => {
    // console.log(result);
    // 이미지 업로드가 제대로 되면
    // 1. pinterestCount에서 name이 total을 찾아서 결과중에 count값을 찾아서 pinterest의 id값으로 입력을 한다.
    // 그리고 pinterest에 값이 제대로 입력이 되면 다시 pinterestCount의 count값을 1증가시켜서 update한다.
    db.collection("pinterestCount").findOne({ name: "total" }, (err, result01) => {
      const count = result01.count;
      db.collection("pinterest").insertOne(
        {
          title: title,
          date: date,
          category: category,
          desc: desc,
          point: point,
          image: result.url,
          id: count,
        },
        (err, result) => {
          db.collection("pinterestCount").updateOne({ name: "total" }, { $inc: { count: 1 } }, (err, result) => {
            if (err) {
              console.log(err);
            }
            res.redirect("/");
          });
        }
      );
    });
  });
});
app.get("/delete", (req, res) => {
  // console.log(req.query.id);
  db.collection("pinterest").deleteOne({ id: parseInt(req.query.id) }, (err, result) => {
    if (result.deletedCount > 0) {
      res.json({ isDelete: true });
    } else {
      res.json({ isDelete: false });
    }
  });
});
app.listen(PORT, () => {
  console.log(`${PORT}에서 서버 대기중5`);
});
