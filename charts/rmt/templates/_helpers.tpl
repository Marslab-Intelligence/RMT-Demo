{{- define "rmt.fullname" -}}
{{ .Release.Name }}
{{- end -}}

{{- define "rmt.labels" -}}
app.kubernetes.io/name: rmt
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
