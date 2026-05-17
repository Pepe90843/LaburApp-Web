import json
from datetime import datetime, time, timedelta

from django.contrib import admin
from django.shortcuts import render
from django.urls import path
from django.utils import timezone

from . import business_metrics
from .models import (
    AdminLog,
    Chat,
    ChatUsuario,
    Conversacion,
    Denuncia,
    Disputa,
    HistorialPago,
    Mensaje,
    MetodoPago,
    Notificacion,
    Postulacion,
    PuntuacionCategoria,
    Trabajo,
    Usuario,
    UsuarioEliminado,
    Valoracion,
)


def _parse_admin_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _aware_datetime(date_value, day_time):
    return timezone.make_aware(datetime.combine(date_value, day_time), timezone.get_current_timezone())


def _date_range_from_request(request):
    selected_day = _parse_admin_date(request.GET.get("fecha"))
    start_day = _parse_admin_date(request.GET.get("desde"))
    end_day = _parse_admin_date(request.GET.get("hasta"))

    if selected_day:
        start_day = selected_day
        end_day = selected_day
        mode = "day"
    else:
        today = timezone.localdate()
        start_day = start_day or today - timedelta(days=29)
        end_day = end_day or today
        if start_day > end_day:
            start_day, end_day = end_day, start_day
        mode = "range"

    start_at = _aware_datetime(start_day, time.min)
    end_at = _aware_datetime(end_day, time.max)
    days_count = (end_day - start_day).days + 1
    previous_end = start_at - timedelta(microseconds=1)
    previous_start = previous_end - timedelta(days=days_count) + timedelta(microseconds=1)

    return {
        "mode": mode,
        "start_day": start_day,
        "end_day": end_day,
        "start_at": start_at,
        "end_at": end_at,
        "days_count": days_count,
        "previous_start": previous_start,
        "previous_end": previous_end,
    }


def business_metrics_view(request):
    date_range = _date_range_from_request(request)
    from_dt = date_range["start_at"]
    to_dt = date_range["end_at"]
    prev_from = date_range["previous_start"]
    prev_to = date_range["previous_end"]

    kpis = business_metrics.get_kpi_counts(from_dt, to_dt, prev_from, prev_to)
    login_metrics = business_metrics.get_login_metrics(from_dt, to_dt)
    payment_metrics = business_metrics.get_payment_metrics(from_dt, to_dt, prev_from, prev_to)
    commission_metrics = business_metrics.get_commission_metrics(from_dt, to_dt, prev_from, prev_to)
    daily_series = business_metrics.get_daily_series(from_dt, to_dt)
    cumulative_series = business_metrics.get_cumulative_series(daily_series)
    top_publishers = business_metrics.get_top_publishers(from_dt, to_dt)
    top_publisher = top_publishers[0] if top_publishers else None
    category_rows = business_metrics.get_jobs_by_category(from_dt, to_dt)
    status_rows = business_metrics.get_jobs_by_status(from_dt, to_dt)

    context = {
        **admin.site.each_context(request),
        "title": "Metricas avanzadas",
        "opts": Usuario._meta,
        "date_range": date_range,
        "filters": {
            "fecha": request.GET.get("fecha", ""),
            "desde": request.GET.get("desde", "") if not request.GET.get("fecha") else "",
            "hasta": request.GET.get("hasta", "") if not request.GET.get("fecha") else "",
        },
        "summary": {
            "new_users": kpis["new_users"],
            "new_users_change": business_metrics.pct_change(kpis["new_users"], kpis["prev_users"]),
            "total_users": kpis["total_users"],
            "jobs_count": kpis["new_jobs"],
            "jobs_change": business_metrics.pct_change(kpis["new_jobs"], kpis["prev_jobs"]),
            "total_jobs": kpis["total_jobs"],
            "applications": kpis["new_applications"],
            "applications_change": business_metrics.pct_change(kpis["new_applications"], kpis["prev_applications"]),
            "messages": kpis["new_messages"],
            "messages_change": business_metrics.pct_change(kpis["new_messages"], kpis["prev_messages"]),
            "reports": kpis["new_reports"],
            "reports_change": business_metrics.pct_change(kpis["new_reports"], kpis["prev_reports"]),
            "reviews": kpis["new_reviews"],
            "reviews_change": business_metrics.pct_change(kpis["new_reviews"], kpis["prev_reviews"]),
            "active_users": login_metrics["active_users"],
            "subscribed_logins": login_metrics["subscribed_logins"],
            "payments_total": payment_metrics["current_total"],
            "payments_change": payment_metrics["change"],
            "commissions_total": commission_metrics["current_total"],
            "commissions_change": commission_metrics["change"],
            "active_publishers": business_metrics.get_active_publishers_count(from_dt, to_dt),
            "top_publisher_name": (
                (top_publisher["publicador__nombre_completo"] or top_publisher["publicador__email"])
                if top_publisher
                else "Sin datos"
            ),
            "top_publisher_total": top_publisher["count"] if top_publisher else 0,
        },
        "top_publishers": top_publishers,
        "top_workers": business_metrics.get_top_workers(from_dt, to_dt),
        "top_messagers": business_metrics.get_message_activity_by_user(from_dt, to_dt),
        "line_chart_data": json.dumps(daily_series),
        "cumulative_chart_data": json.dumps(cumulative_series),
        "category_chart_data": json.dumps(
            {
                "labels": [row["id_categoria"] or "otros" for row in category_rows],
                "values": [row["total"] for row in category_rows],
            }
        ),
        "status_chart_data": json.dumps(
            {
                "labels": [row["estado"] or "Sin estado" for row in status_rows],
                "values": [row["total"] for row in status_rows],
            }
        ),
    }
    return render(request, "admin/business_metrics.html", context)


original_get_urls = admin.site.get_urls


def get_admin_urls():
    custom_urls = [
        path(
            "metricas-avanzadas/",
            admin.site.admin_view(business_metrics_view),
            name="business_metrics",
        ),
    ]
    return custom_urls + original_get_urls()


admin.site.get_urls = get_admin_urls


class AllFieldsAdmin(admin.ModelAdmin):
    list_display = ()

    def __init__(self, model, admin_site):
        self.list_display = tuple(field.name for field in model._meta.fields)
        super().__init__(model, admin_site)


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = tuple(field.name for field in Usuario._meta.fields)
    search_fields = ("uid", "email", "nombre_completo", "dni")
    list_filter = ("baneado", "renovacion_automatica_cliente", "renovacion_automatica_trabajador")


@admin.register(Trabajo)
class TrabajoAdmin(admin.ModelAdmin):
    list_display = tuple(field.name for field in Trabajo._meta.fields)
    search_fields = ("id_trabajo", "titulo", "descripcion", "direccion")
    list_filter = ("estado", "es_tarea_premium", "pago_retenido")


@admin.register(Mensaje)
class MensajeAdmin(admin.ModelAdmin):
    list_display = tuple(field.name for field in Mensaje._meta.fields)
    search_fields = ("id_mensaje", "contenido")
    list_filter = ("tipo_contenido", "leido")


for model in (
    Disputa,
    Chat,
    Valoracion,
    Notificacion,
    MetodoPago,
    HistorialPago,
    Denuncia,
    AdminLog,
    UsuarioEliminado,
):
    admin.site.register(model, AllFieldsAdmin)
