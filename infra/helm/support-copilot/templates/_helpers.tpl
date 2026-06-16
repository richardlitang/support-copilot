{{- define "support-copilot.labels" -}}
app.kubernetes.io/name: support-copilot
app.kubernetes.io/managed-by: Helm
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end -}}

{{- define "support-copilot.componentLabels" -}}
{{ include "support-copilot.labels" .root }}
app.kubernetes.io/component: {{ .component | quote }}
{{- end -}}

{{- define "support-copilot.appImage" -}}
{{ printf "%s:%s" .Values.image.repository .Values.image.tag }}
{{- end -}}

{{- define "support-copilot.redisImage" -}}
{{ printf "%s:%s" .Values.redis.image.repository .Values.redis.image.tag }}
{{- end -}}
