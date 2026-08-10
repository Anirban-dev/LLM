import json
import requests
import streamlit as st

st.set_page_config(page_title="Local LLM Explorer", page_icon="🤖")

st.title("🤖 Local AI API Explorer")

st.sidebar.header("Configuration")
api_url = "http://localhost:8000/v1/chat/completions"
st.sidebar.caption("API Endpoint")
st.sidebar.code(api_url, language="text")

model_name = "mini-llm"

stream_mode = st.sidebar.toggle("Enable Streaming Mode", value=True)

user_prompt = st.text_area(
    "Enter your prompt:",
    value="Why is the sky blue?",
    height=120,
)

if st.button("Generate Response", type="primary"):
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": user_prompt}],
        "stream": stream_mode,
    }

    st.subheader("Output")

    # MODE 1: STREAMING
    if stream_mode:

        def stream_generator():
            try:
                response = requests.post(
                    api_url, headers=headers, json=payload, stream=True
                )
                response.raise_for_status()

                for line in response.iter_lines():
                    if line:
                        line_text = line.decode("utf-8").strip()
                        if line_text.startswith("data: "):
                            data_str = line_text[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                content = (
                                    data.get("choices", [{}])[0]
                                    .get("delta", {})
                                    .get("content", "")
                                )
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                pass
            except Exception as e:
                yield f"\n\n**Error:** {str(e)}"

        st.write_stream(stream_generator())

    # MODE 2: NON-STREAMING
    else:
        with st.spinner("Waiting for response..."):
            try:
                response = requests.post(
                    api_url, headers=headers, json=payload, stream=False
                )
                response.raise_for_status()
                data = response.json()

                content = data["choices"][0]["message"]["content"]
                st.write(content)
            except Exception as e:
                st.error(f"Error fetching response: {e}")