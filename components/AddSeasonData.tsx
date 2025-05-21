import React, { useState, useEffect } from "react";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { db } from "../services/FirebaseService"; // Ensure this path is correct
import { format, addDays, eachDayOfInterval } from "date-fns";

const dayNames = {
  en: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  sk: ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"],
};

interface Resort {
  id: string;
  name: string;
}
interface Course {
  id: string;
  name: string;
}

const AddSeasonData: React.FC = () => {
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [selectedResort, setSelectedResort] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [seasonName, setSeasonName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const resortCollectionRef = collection(db, "resorts");
        const resortSnapshot = await getDocs(resortCollectionRef);
        const resortList = resortSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || doc.id, // Fallback to id if name field is missing
        }));
        setResorts(resortList); // Set the resorts in state
      } catch (err) {
        console.error("Chyba napájania kolekcie resorts: ", err);
        setError("Chyba napájania kolekcie resorts.");
      }
    };
    fetchResorts();
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!selectedResort) return;

      try {
        const resortDocRef = collection(
          db,
          "resorts",
          selectedResort,
          "courses"
        );
        const coursesSnapshot = await getDocs(resortDocRef);
        const courseList = coursesSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || doc.id, // Fallback to id if name field is missing
        }));
        setCourses(courseList); // Set the courses in state
      } catch (err) {
        console.error("Chyba napájania kolekcie courses: ", err);
        setError("Chyba napájania kolekcie courses.");
      }
    };
    fetchCourses();
  }, [selectedResort]);

  const generateSeasonData = () => {
    if (!seasonName || !startDate || !endDate) {
      alert("Please fill in all fields.");
      return null;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate the first Monday before or on the start date
    const firstMonday =
      start.getDay() === 0
        ? addDays(start, 1)
        : addDays(start, -((start.getDay() + 6) % 7));

    // Generate weeks from start to end
    const weeks = [];
    let currentStart = firstMonday;

    while (currentStart <= end) {
      // Calculate end of this week
      const weekEnd = addDays(currentStart, 6);

      // If weekEnd exceeds end date, cap it at end date for incomplete weeks
      const actualWeekEnd = weekEnd > end ? end : weekEnd;

      // Collect days for the current week, whether complete or incomplete
      const days = eachDayOfInterval({
        start: currentStart,
        end: actualWeekEnd, // End on the last date if incomplete week
      }).map((currentDay) => {
        const dayIndex = currentDay.getDay();
        return {
          date: format(currentDay, "yyyy-MM-dd"),
          dayOfWeek: {
            en: dayNames.en[dayIndex],
            sk: dayNames.sk[dayIndex],
          },
        };
      });

      // Add the week to the list
      weeks.push({
        startOfWeek: format(currentStart, "yyyy-MM-dd"),
        endOfWeek: format(actualWeekEnd, "yyyy-MM-dd"),
        days,
      });

      // Move to the start of the next week
      currentStart = addDays(currentStart, 7);
    }

    return {
      season: seasonName,
      startDate,
      endDate,
      weeks,
    };
  };

  const addSeasonToDatabase = async () => {
    setLoading(true);
    setError(null);

    if (!selectedResort || !selectedCourse || !seasonName) {
      alert("Prosím vyplnte všetky polia.");
      setLoading(false);
      return;
    }

    const seasonData = generateSeasonData();
    if (!seasonData) return; // If generation failed, exit

    try {
      const resortDocRef = doc(collection(db, "resorts"), selectedResort);
      const courseDocRef = doc(
        collection(resortDocRef, "courses"),
        selectedCourse
      );
      const seasonDocRef = doc(
        collection(courseDocRef, "seasons"),
        seasonName.replace(/[^a-zA-Z0-9]/g, "_")
      );

      await setDoc(seasonDocRef, seasonData);
      alert("Kalendár úspešne pridaný!");
    } catch (err) {
      console.error("Chyba pri pridávaní kalendáru: ", err);
      setError("Chyba pri pridávaní kalendáru.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-season-form">
      <h2 className="form-heading">Pridať sezónny kalendár</h2>
      <div className="form-group">
        <label className="form-label">
          Vybrať stredisko:
          <select
            value={selectedResort}
            onChange={(e) => setSelectedResort(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Vybrať stredisko --</option>
            {resorts.map((resort) => (
              <option key={resort.id} value={resort.id}>
                {resort.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedResort && (
        <div className="form-group">
          <label className="form-label">
            Vybrať tréningovú trať:
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              disabled={loading}
            >
              <option value="">-- Vybrať trať --</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">
          Názov nového sezónneho kalendára:
          <span className="info-icon">
            <i className="fas fa-info-circle"></i>
            <span className="tooltip-text">
              Musí obsahovať v názve rok sezóny v tvare 2024/2025, príklad:
              sezóna 2024/2025.
            </span>
          </span>
          <input
            type="text"
            className="form-string-input"
            value={seasonName}
            onChange={(e) => setSeasonName(e.target.value)}
            disabled={loading}
            placeholder="Zadajte názov"
          />
        </label>
      </div>
      <div className="form-group">
        <label className="form-label">
          Začiatok sezóny:
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
      </div>
      <div className="form-group">
        <label className="form-label">
          Koniec sezóny:
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>
      <button
        className="btn btn-primary"
        onClick={addSeasonToDatabase}
        disabled={loading}
      >
        {loading ? "Pridávam..." : "Pridať kalendár"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default AddSeasonData;
