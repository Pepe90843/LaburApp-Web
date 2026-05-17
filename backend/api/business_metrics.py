"""
ORM query functions for the LaburApp business metrics dashboard.

All functions accept datetime bounds and return plain dictionaries/lists so the
Django admin view stays focused on rendering.
"""

from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDate, TruncMonth

from .models import (
    Denuncia,
    HistorialPago,
    Mensaje,
    Postulacion,
    Trabajo,
    Usuario,
    Valoracion,
)


def _users_qs():
    return Usuario.objects.all()


def _fill_daily(rows_qs, from_dt, to_dt):
    data = {row["day"]: row["total"] for row in rows_qs}
    labels = []
    values = []
    day = from_dt.date() if isinstance(from_dt, datetime) else from_dt
    end_day = to_dt.date() if isinstance(to_dt, datetime) else to_dt
    while day <= end_day:
        labels.append(day.isoformat())
        values.append(data.get(day, 0))
        day += timedelta(days=1)
    return labels, values


def pct_change(current, previous):
    if previous == 0:
        value = 100 if current > 0 else 0
    else:
        value = round(((current - previous) / previous) * 100, 1)

    if value > 0:
        return {"value": f"+{value}", "direction": "up"}
    if value < 0:
        return {"value": str(value), "direction": "down"}
    return {"value": "0", "direction": "flat"}


def get_kpi_counts(from_dt, to_dt, prev_from, prev_to):
    current_range = (from_dt, to_dt)
    previous_range = (prev_from, prev_to)

    new_users = _users_qs().filter(fecha_ingreso__range=current_range).count()
    prev_users = _users_qs().filter(fecha_ingreso__range=previous_range).count()
    total_users = _users_qs().count()

    new_jobs = Trabajo.objects.filter(fecha_publicacion__range=current_range).count()
    prev_jobs = Trabajo.objects.filter(fecha_publicacion__range=previous_range).count()
    total_jobs = Trabajo.objects.count()

    new_applications = Postulacion.objects.filter(fecha_postulacion__range=current_range).count()
    prev_applications = Postulacion.objects.filter(fecha_postulacion__range=previous_range).count()
    total_applications = Postulacion.objects.count()

    new_messages = Mensaje.objects.filter(fecha_envio__range=current_range).count()
    prev_messages = Mensaje.objects.filter(fecha_envio__range=previous_range).count()
    total_messages = Mensaje.objects.count()

    new_reports = Denuncia.objects.filter(fecha__range=current_range).count()
    prev_reports = Denuncia.objects.filter(fecha__range=previous_range).count()
    total_reports = Denuncia.objects.count()

    new_reviews = Valoracion.objects.filter(fecha__range=current_range).count()
    prev_reviews = Valoracion.objects.filter(fecha__range=previous_range).count()
    total_reviews = Valoracion.objects.count()

    return {
        "new_users": new_users,
        "prev_users": prev_users,
        "total_users": total_users,
        "new_jobs": new_jobs,
        "prev_jobs": prev_jobs,
        "total_jobs": total_jobs,
        "new_applications": new_applications,
        "prev_applications": prev_applications,
        "total_applications": total_applications,
        "new_messages": new_messages,
        "prev_messages": prev_messages,
        "total_messages": total_messages,
        "new_reports": new_reports,
        "prev_reports": prev_reports,
        "total_reports": total_reports,
        "new_reviews": new_reviews,
        "prev_reviews": prev_reviews,
        "total_reviews": total_reviews,
    }


def get_login_metrics(from_dt, to_dt):
    active_users = _users_qs().filter(ultimo_login__range=(from_dt, to_dt)).count()
    subscribed_logins = _users_qs().filter(ultimo_login__range=(from_dt, to_dt), ultimo_login_suscrito=True).count()
    return {
        "active_users": active_users,
        "subscribed_logins": subscribed_logins,
    }


def get_daily_series(from_dt, to_dt):
    users_qs = (
        _users_qs()
        .filter(fecha_ingreso__range=(from_dt, to_dt))
        .annotate(day=TruncDate("fecha_ingreso"))
        .values("day")
        .annotate(total=Count("uid"))
        .order_by("day")
    )
    jobs_qs = (
        Trabajo.objects.filter(fecha_publicacion__range=(from_dt, to_dt))
        .annotate(day=TruncDate("fecha_publicacion"))
        .values("day")
        .annotate(total=Count("id_trabajo"))
        .order_by("day")
    )
    applications_qs = (
        Postulacion.objects.filter(fecha_postulacion__range=(from_dt, to_dt))
        .annotate(day=TruncDate("fecha_postulacion"))
        .values("day")
        .annotate(total=Count("trabajo"))
        .order_by("day")
    )
    messages_qs = (
        Mensaje.objects.filter(fecha_envio__range=(from_dt, to_dt))
        .annotate(day=TruncDate("fecha_envio"))
        .values("day")
        .annotate(total=Count("id_mensaje"))
        .order_by("day")
    )
    reports_qs = (
        Denuncia.objects.filter(fecha__range=(from_dt, to_dt))
        .annotate(day=TruncDate("fecha"))
        .values("day")
        .annotate(total=Count("id_denuncia"))
        .order_by("day")
    )

    labels, users_vals = _fill_daily(users_qs, from_dt, to_dt)
    _, jobs_vals = _fill_daily(jobs_qs, from_dt, to_dt)
    _, applications_vals = _fill_daily(applications_qs, from_dt, to_dt)
    _, messages_vals = _fill_daily(messages_qs, from_dt, to_dt)
    _, reports_vals = _fill_daily(reports_qs, from_dt, to_dt)

    return {
        "labels": labels,
        "users": users_vals,
        "jobs": jobs_vals,
        "applications": applications_vals,
        "messages": messages_vals,
        "reports": reports_vals,
    }


def get_cumulative_series(daily):
    cumulative = {}
    for key in ("users", "jobs", "applications", "messages", "reports"):
        total = 0
        cumulative[key] = []
        for value in daily[key]:
            total += value
            cumulative[key].append(total)
    return cumulative


def get_jobs_by_status(from_dt, to_dt):
    return list(
        Trabajo.objects.filter(fecha_publicacion__range=(from_dt, to_dt))
        .values("estado")
        .annotate(total=Count("id_trabajo"))
        .order_by("-total", "estado")
    )


def get_jobs_by_category(from_dt, to_dt):
    return list(
        Trabajo.objects.filter(fecha_publicacion__range=(from_dt, to_dt))
        .values("id_categoria")
        .annotate(total=Count("id_trabajo"))
        .order_by("-total", "id_categoria")
    )


def get_payment_metrics(from_dt, to_dt, prev_from, prev_to):
    current_total = (
        HistorialPago.objects.filter(fecha_emision__range=(from_dt, to_dt)).aggregate(total=Sum("monto"))["total"] or 0
    )
    previous_total = (
        HistorialPago.objects.filter(fecha_emision__range=(prev_from, prev_to)).aggregate(total=Sum("monto"))["total"] or 0
    )
    return {
        "current_total": round(float(current_total), 2),
        "previous_total": round(float(previous_total), 2),
        "change": pct_change(float(current_total), float(previous_total)),
    }


def get_commission_metrics(from_dt, to_dt, prev_from, prev_to):
    commission_expr = ExpressionWrapper(
        F("pago_cliente") - F("pago_trabajador"),
        output_field=DecimalField(max_digits=10, decimal_places=2),
    )
    current_total = (
        Trabajo.objects.filter(fecha_completada__range=(from_dt, to_dt))
        .exclude(pago_cliente__isnull=True)
        .exclude(pago_trabajador__isnull=True)
        .aggregate(total=Sum(commission_expr))["total"]
        or 0
    )
    previous_total = (
        Trabajo.objects.filter(fecha_completada__range=(prev_from, prev_to))
        .exclude(pago_cliente__isnull=True)
        .exclude(pago_trabajador__isnull=True)
        .aggregate(total=Sum(commission_expr))["total"]
        or 0
    )
    return {
        "current_total": round(float(current_total), 2),
        "previous_total": round(float(previous_total), 2),
        "change": pct_change(float(current_total), float(previous_total)),
    }


def get_top_publishers(from_dt, to_dt, limit=10):
    return list(
        Trabajo.objects.filter(fecha_publicacion__range=(from_dt, to_dt))
        .values("publicador__uid", "publicador__nombre_completo", "publicador__email")
        .annotate(count=Count("id_trabajo"))
        .order_by("-count", "publicador__email")[:limit]
    )


def get_active_publishers_count(from_dt, to_dt):
    return (
        Trabajo.objects.filter(fecha_publicacion__range=(from_dt, to_dt))
        .values("publicador")
        .distinct()
        .count()
    )


def get_top_workers(from_dt, to_dt, limit=10):
    return list(
        Trabajo.objects.filter(fecha_aceptacion__range=(from_dt, to_dt), trabajador__isnull=False)
        .values("trabajador__uid", "trabajador__nombre_completo", "trabajador__email")
        .annotate(count=Count("id_trabajo"))
        .order_by("-count", "trabajador__email")[:limit]
    )


def get_message_activity_by_user(from_dt, to_dt, limit=10):
    sent = defaultdict(int)
    user_info = {}
    rows = (
        Mensaje.objects.filter(fecha_envio__range=(from_dt, to_dt))
        .values("emisor__uid", "emisor__nombre_completo", "emisor__email")
        .annotate(count=Count("id_mensaje"))
        .order_by("-count")[:limit]
    )
    for row in rows:
        uid = row["emisor__uid"]
        sent[uid] += row["count"]
        user_info[uid] = {
            "uid": uid,
            "name": row["emisor__nombre_completo"] or row["emisor__email"] or uid,
        }
    return [
        {"uid": uid, "name": info["name"], "messages": sent[uid]}
        for uid, info in sorted(user_info.items(), key=lambda item: sent[item[0]], reverse=True)
    ]


def get_monthly_historical():
    rows = (
        _users_qs()
        .annotate(month=TruncMonth("fecha_ingreso"))
        .values("month")
        .annotate(total=Count("uid"))
        .order_by("month")
    )
    return {
        "labels": [row["month"].strftime("%Y-%m") for row in rows if row["month"]],
        "values": [row["total"] for row in rows if row["month"]],
    }
