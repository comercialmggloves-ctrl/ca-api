import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const ca = req.query.numero;

    if (!ca) {
      return res.status(400).json({ success: false, error: "CA não informado" });
    }

    const url = "https://caepi.mte.gov.br/internet/ConsultaCAInternet.aspx";

    const initial = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120"
      }
    });

    const cookies = initial.headers["set-cookie"];
    const $ = cheerio.load(initial.data);

    const viewState = $("#__VIEWSTATE").val();
    const eventValidation = $("#__EVENTVALIDATION").val();
    const viewStateGenerator = $("#__VIEWSTATEGENERATOR").val();

    if (!viewState || !eventValidation) {
      return res
        .status(500)
        .json({ success: false, error: "Tokens ASP.NET não encontrados" });
    }

    const form = new URLSearchParams({
      "__EVENTTARGET": "",
      "__EVENTARGUMENT": "",
      "__VIEWSTATE": viewState,
      "__VIEWSTATEGENERATOR": viewStateGenerator || "",
      "__EVENTVALIDATION": eventValidation,
      "ctl00$ContentPlaceHolder1$txtNumeroCA": ca,
      "ctl00$ContentPlaceHolder1$btnConsultar": "Consultar"
    });

    const response = await axios.post(url, form.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
        Cookie: cookies.join("; "),
        Referer: url
      }
    });

    const $$ = cheerio.load(response.data);
    const validade = $("#ctl00_ContentPlaceHolder1_lblValidade").text().trim();

    if (!validade) {
      return res.json({
        success: false,
        ca,
        expiration_date: null,
        message: "CA não encontrado ou sem validade"
      });
    }

    const [dia, mes, ano] = validade.split("/");
    const expiration_date = `${ano}-${mes}-${dia}`;

    return res.json({
      success: true,
      ca,
      expiration_date,
      source: "caepi.mte.gov.br",
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Erro ao consultar CA",
      details: error.message
    });
  }
}
