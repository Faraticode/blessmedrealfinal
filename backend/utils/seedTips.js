// Run with: npm run seed
require("dotenv").config();
const connectDB = require("../config/db");
const HealthTip = require("../models/HealthTip");

const tips = [
  {
    category: "nutrition",
    title: "Stay hydrated",
    content: "Aim for at least 8 glasses of water a day to support digestion and energy levels.",
  },
  {
    category: "nutrition",
    title: "Eat the rainbow",
    content: "Include a variety of colorful fruits and vegetables to get a wide range of nutrients.",
  },
  {
    category: "exercise",
    title: "Move for 30 minutes",
    content: "Even a brisk daily walk of 30 minutes can improve cardiovascular health.",
  },
  {
    category: "exercise",
    title: "Stretch daily",
    content: "A few minutes of stretching each morning improves flexibility and reduces injury risk.",
  },
  {
    category: "mental_wellness",
    title: "Practice deep breathing",
    content: "Take 5 minutes to breathe deeply when stressed — it activates your body's relaxation response.",
  },
  {
    category: "mental_wellness",
    title: "Prioritize sleep",
    content: "Aim for 7-9 hours of sleep a night to support mood, memory, and overall health.",
  },
];

(async () => {
  await connectDB();
  await HealthTip.deleteMany({});
  await HealthTip.insertMany(tips);
  console.log(`Seeded ${tips.length} health tips`);
  process.exit(0);
})();
