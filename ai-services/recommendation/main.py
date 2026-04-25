from fastapi import FastAPI

app = FastAPI(title="AI Recommendation Engine")

@app.get("/recommend-alternatives/{medicine_name}")
async def recommend_alternative(medicine_name: str):
    # Basic logic to suggest cheaper generics
    return {
        "queried_medicine": medicine_name,
        "generic_alternatives": [
            {
                "name": f"Generic {medicine_name}",
                "price_savings": "40%",
                "confidence_score": 0.95
            }
        ]
    }
