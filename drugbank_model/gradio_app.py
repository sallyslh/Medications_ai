"""
gradio_app.py
════════════════════════════════════════════════════════════════════════════
Standalone Gradio demo UI for the drug recommendation system.

This module is intentionally isolated from the rest of the package: Django
must never import this file (it imports `gradio`, which the Django backend
does not need and should not depend on).

Run directly for local/manual testing:

    python -m drugbank_model.gradio_app

All actual ML/business logic lives in the sibling modules (`predictor`,
`interactions`, `adverse`, `patient_loader`, `loader`) — this file only
wires them up to a UI.
"""

from __future__ import annotations

from datetime import datetime

import gradio as gr
import pandas as pd

from drugbank_model import adverse, interactions, loader, patient_loader, predictor

# ──────────────────────────────────────────────────────────────────────────
# Demo-only session state (single-process Gradio app; NOT used by Django)
# ──────────────────────────────────────────────────────────────────────────
_selected_patient_id: str | None = None
_recommendations_history: list[dict] = []

CUSTOM_CSS = """
.gradio-container {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    font-family: 'Inter', 'Segoe UI', sans-serif;
    color: #e2e8f0;
}
.gr-button {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8) !important;
    border: none !important;
    color: white !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
}
.gr-dataframe { background: #1e293b !important; border: 1px solid #475569 !important; }
"""


def _patients_df() -> pd.DataFrame:
    return patient_loader.load_patient_data()


def _refresh_patient_choices():
    df = _patients_df()
    if df.empty:
        return gr.update(choices=["No patients available"], value="No patients available")
    return gr.update(
        choices=["Select a patient..."] + df["patient_id"].tolist(),
        value="Select a patient...",
    )


def _on_search(search_term: str) -> pd.DataFrame:
    return patient_loader.search_patients(search_term, df=_patients_df())


def _on_select_patient(patient_id: str):
    global _selected_patient_id
    _selected_patient_id = patient_id

    if patient_id in (None, "Select a patient...", "No patients available"):
        return "No patient selected", "", "", "", "", _patients_df()

    patient = patient_loader.select_patient(patient_id, df=_patients_df())
    if patient is None:
        return "Patient not found", "", "", "", "", _patients_df()

    info_html = f"""
    <div style="background:#334155;padding:16px;border-radius:10px;color:#f1f5f9;">
        <b>{patient['name']}</b> &middot; {patient['age']}y &middot; {patient['gender']}<br/>
        <b>Medications:</b> {patient['medications']}<br/>
        <b>Conditions:</b> {patient['conditions']}
    </div>
    """
    return (
        info_html,
        str(patient["age"]),
        patient["gender"],
        patient["medications"],
        patient["conditions"],
        _patients_df(),
    )


def _get_recommendations(condition, patient_age, patient_gender, current_medications):
    if not condition or not condition.strip():
        return "❌ Please enter a condition to treat.", "", pd.DataFrame()

    if not _selected_patient_id or _selected_patient_id in (
        "Select a patient...",
        "No patients available",
    ):
        return "❌ Please select a patient first.", "", pd.DataFrame()

    drugs = predictor.predict_multiple_drugs(
        condition, patient_age, patient_gender, current_medications, top_k=3
    )

    if not drugs or drugs == ["No recommendation available"]:
        return "❌ No drug recommendations available for this condition.", "", pd.DataFrame()

    rows = []
    for drug in drugs:
        is_safe, detailed, _summary = interactions.check_drug_safety(
            drug, current_medications
        )
        adr_text = adverse.predict_adverse_reactions(
            drug, patient_age, patient_gender, current_medications
        )
        interaction_details = (
            " | ".join(f"{i['interacting_drug']} ({i['severity']})" for i in detailed)
            if detailed
            else "None detected"
        )
        rows.append(
            {
                "Drug Name": drug,
                "Safety Status": "✅ SAFE" if is_safe else "⚠️ INTERACTIONS",
                "Interacting Drugs": interaction_details,
                "Predicted Adverse Reactions": (
                    adr_text[:100] + "..." if len(str(adr_text)) > 100 else adr_text
                ),
            }
        )

    result_html = f"""
    <div style="background:#1e293b;padding:20px;border-radius:15px;color:#f1f5f9;">
        <h3>💊 AI Drug Recommendations</h3>
        <p><b>Condition:</b> {condition} &middot; <b>Current meds:</b> {current_medications}</p>
        <p>{len(rows)} recommendations generated. Click a row below to prescribe.</p>
    </div>
    """
    return result_html, "Click a drug name below to prescribe it:", pd.DataFrame(rows)


def _on_select_drug(condition, age, gender, medications, evt: gr.SelectData):
    global _selected_patient_id

    if not evt.row_value:
        return "No drug selected", _patients_df(), gr.update()

    drug_name = evt.row_value[0]

    success, message, updated_df = patient_loader.update_patient(
        _selected_patient_id, drug_name, condition, df=_patients_df()
    )

    if success:
        _recommendations_history.append(
            {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "patient_id": _selected_patient_id,
                "condition": condition,
                "prescribed_drug": drug_name,
            }
        )
        status_html = f'<div style="color:#22c55e;">✅ {message}</div>'
    else:
        status_html = f'<div style="color:#ef4444;">❌ {message}</div>'

    history_html = "<div>" + "".join(
        f"<p>{h['timestamp']} — {h['patient_id']}: {h['prescribed_drug']} for {h['condition']}</p>"
        for h in _recommendations_history[-10:]
    ) + "</div>"

    return status_html, updated_df, history_html


def build_demo() -> gr.Blocks:
    """Construct (but do not launch) the Gradio Blocks app."""
    with gr.Blocks(css=CUSTOM_CSS, title="Drug Recommendation System") as demo:
        gr.HTML("<h1>💊 AI Drug Recommendation System</h1>")

        with gr.Tabs():
            with gr.TabItem("👥 Patient Database"):
                with gr.Row():
                    search_input = gr.Textbox(label="Search patients")
                    refresh_btn = gr.Button("🔄 Refresh")
                dataset_display = gr.Dataframe(value=_patients_df())
                patient_dropdown = gr.Dropdown(
                    label="Select patient",
                    choices=["Select a patient..."]
                    + (
                        _patients_df()["patient_id"].tolist()
                        if not _patients_df().empty
                        else []
                    ),
                )
                patient_info_display = gr.HTML()

            with gr.TabItem("💊 Recommendations"):
                condition_input = gr.Textbox(label="Condition to treat")
                patient_age = gr.Textbox(label="Patient age", visible=True)
                patient_gender = gr.Textbox(label="Patient gender", visible=True)
                patient_medications = gr.Textbox(
                    label="Current medications", visible=True
                )
                patient_conditions = gr.Textbox(
                    label="Patient conditions", visible=False
                )
                recommend_btn = gr.Button("🔍 Get Recommendations")
                recommendation_output = gr.HTML()
                selection_instruction = gr.HTML(visible=False)
                drug_options_table = gr.Dataframe(visible=False)
                status_message = gr.HTML()

            with gr.TabItem("📚 History & Model Status"):
                model = loader.get_model()
                gr.HTML(
                    f"""
                    <div style="color:#f1f5f9;">
                        <p>Drug model: {'✅ loaded' if model else '❌ not loaded'}</p>
                        <p>Interactions CSV: {'✅ available' if interactions.is_available() else '❌ not found'}</p>
                        <p>ADR model: {'✅ active' if adverse.get_adr_model() else '📄 unavailable (returns "None")'}</p>
                    </div>
                    """
                )
                history_display = gr.HTML()

        # ── Event wiring ────────────────────────────────────────────────
        search_input.change(fn=_on_search, inputs=[search_input], outputs=[dataset_display])
        refresh_btn.click(fn=_refresh_patient_choices, outputs=[patient_dropdown])
        patient_dropdown.change(
            fn=_on_select_patient,
            inputs=[patient_dropdown],
            outputs=[
                patient_info_display,
                patient_age,
                patient_gender,
                patient_medications,
                patient_conditions,
                dataset_display,
            ],
        )

        def _show_recommendations(condition, age, gender, meds, conditions):
            html, instruction, df = _get_recommendations(condition, age, gender, meds)
            if df.empty:
                return html, gr.update(visible=False), gr.update(visible=False)
            return (
                html,
                gr.update(value=instruction, visible=True),
                gr.update(value=df, visible=True),
            )

        recommend_btn.click(
            fn=_show_recommendations,
            inputs=[
                condition_input,
                patient_age,
                patient_gender,
                patient_medications,
                patient_conditions,
            ],
            outputs=[recommendation_output, selection_instruction, drug_options_table],
        )

        drug_options_table.select(
            fn=_on_select_drug,
            inputs=[condition_input, patient_age, patient_gender, patient_medications],
            outputs=[status_message, dataset_display, history_display],
        )

    return demo


if __name__ == "__main__":
    demo = build_demo()
    demo.launch(server_name="0.0.0.0", server_port=7860, show_error=True)
